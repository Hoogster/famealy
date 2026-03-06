import com.sap.gateway.ip.core.customdev.util.Message
import groovy.json.JsonSlurper
import groovy.json.JsonOutput
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/**
 * SAP CPI iFlow Script: Prepare Position Filter
 *
 * Liest Departments und Divisions (via SuccessFactors OData V2) und filtert:
 * - Nur Datensätze, die heute oder in Zukunft gültig sind (endDate >= heute)
 * - Nur Zeitabschnitte, in denen cust_HRM nicht leer ist
 *
 * Baut anschliessend einen OData-Filter für die Positions auf Basis der
 * ermittelten Departments (DepartmentNav) und Divisions (DivisionNav).
 */
def Message processData(Message message) {

    def body = message.getBody(String)
    def jsonSlurper = new JsonSlurper()
    def payload = jsonSlurper.parseText(body)

    def today = LocalDate.now()

    // SuccessFactors OData V2 liefert Datumsfelder als /Date(timestamp)/
    def parsesfDate = { String dateStr ->
        if (dateStr == null || dateStr.trim().isEmpty()) {
            return null
        }
        // Format: /Date(1234567890000)/
        def matcher = (dateStr =~ /\/Date\((\-?\d+)\)\//)
        if (matcher.find()) {
            long millis = Long.parseLong(matcher.group(1))
            return java.time.Instant.ofEpochMilli(millis)
                .atZone(java.time.ZoneId.systemDefault())
                .toLocalDate()
        }
        // Fallback: ISO-Datum
        try {
            return LocalDate.parse(dateStr, DateTimeFormatter.ISO_DATE)
        } catch (Exception e) {
            return null
        }
    }

    // ---------------------------------------------------------------
    // Departments filtern: endDate >= heute UND cust_HRM nicht leer
    // ---------------------------------------------------------------
    def departments = payload.d?.results ?: payload.departments?.d?.results ?: []
    def filteredDepartments = []

    departments.each { dept ->
        def endDate = parsesfDate(dept.endDate)
        def startDate = parsesfDate(dept.startDate)
        def custHRM = dept.cust_HRM?.toString()?.trim()

        // Nur Zeitabschnitte ab heute (endDate >= heute) mit gefülltem cust_HRM
        if (endDate != null && !endDate.isBefore(today) && custHRM != null && !custHRM.isEmpty()) {
            filteredDepartments << [
                externalCode  : dept.externalCode,
                startDate     : dept.startDate,
                endDate       : dept.endDate,
                cust_HRM      : custHRM,
                effectiveStatus: dept.effectiveStatus,
                name          : dept.name
            ]
        }
    }

    // ---------------------------------------------------------------
    // Divisions filtern: endDate >= heute UND cust_HRM nicht leer
    // ---------------------------------------------------------------
    def divisions = payload.d?.results ?: payload.divisions?.d?.results ?: []
    // Falls Departments und Divisions im gleichen Payload sind, separate Keys nutzen
    if (payload.departments != null && payload.divisions != null) {
        divisions = payload.divisions?.d?.results ?: []
    }
    def filteredDivisions = []

    divisions.each { div ->
        def endDate = parsesfDate(div.endDate)
        def startDate = parsesfDate(div.startDate)
        def custHRM = div.cust_HRM?.toString()?.trim()

        if (endDate != null && !endDate.isBefore(today) && custHRM != null && !custHRM.isEmpty()) {
            filteredDivisions << [
                externalCode  : div.externalCode,
                startDate     : div.startDate,
                endDate       : div.endDate,
                cust_HRM      : custHRM,
                effectiveStatus: div.effectiveStatus,
                name          : div.name
            ]
        }
    }

    // ---------------------------------------------------------------
    // Eindeutige externalCodes sammeln
    // ---------------------------------------------------------------
    def uniqueDeptCodes = filteredDepartments.collect { it.externalCode }.unique()
    def uniqueDivCodes = filteredDivisions.collect { it.externalCode }.unique()

    // ---------------------------------------------------------------
    // OData-Filter für Position aufbauen
    // Über DepartmentNav resp. DivisionNav die Positionen ermitteln
    // ---------------------------------------------------------------
    def filterParts = []

    uniqueDeptCodes.each { code ->
        filterParts << "departmentNav/externalCode eq '${code}'"
    }

    uniqueDivCodes.each { code ->
        filterParts << "divisionNav/externalCode eq '${code}'"
    }

    def positionFilter = ""
    if (!filterParts.isEmpty()) {
        positionFilter = filterParts.join(" or ")
    }

    // ---------------------------------------------------------------
    // Ergebnisse in Properties und Body speichern
    // ---------------------------------------------------------------
    message.setProperty("filteredDepartments", JsonOutput.toJson(filteredDepartments))
    message.setProperty("filteredDivisions", JsonOutput.toJson(filteredDivisions))
    message.setProperty("positionFilter", positionFilter)
    message.setProperty("uniqueDeptCodes", JsonOutput.toJson(uniqueDeptCodes))
    message.setProperty("uniqueDivCodes", JsonOutput.toJson(uniqueDivCodes))

    // Detaillierte Zuordnung: externalCode -> Liste von Zeitabschnitten mit cust_HRM
    // Wird im zweiten Skript für das zeitabschnittsgenaue Upsert benötigt
    def deptHrmTimeline = [:]
    filteredDepartments.each { dept ->
        def code = dept.externalCode
        if (!deptHrmTimeline.containsKey(code)) {
            deptHrmTimeline[code] = []
        }
        deptHrmTimeline[code] << [
            startDate: dept.startDate,
            endDate  : dept.endDate,
            cust_HRM : dept.cust_HRM
        ]
    }

    def divHrmTimeline = [:]
    filteredDivisions.each { div ->
        def code = div.externalCode
        if (!divHrmTimeline.containsKey(code)) {
            divHrmTimeline[code] = []
        }
        divHrmTimeline[code] << [
            startDate: div.startDate,
            endDate  : div.endDate,
            cust_HRM : div.cust_HRM
        ]
    }

    message.setProperty("deptHrmTimeline", JsonOutput.toJson(deptHrmTimeline))
    message.setProperty("divHrmTimeline", JsonOutput.toJson(divHrmTimeline))

    // Body enthält den OData-Filter für den nächsten Request Step
    message.setBody(positionFilter)

    return message
}
