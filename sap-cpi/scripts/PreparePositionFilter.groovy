import com.sap.gateway.ip.core.customdev.util.Message
import groovy.json.JsonSlurper
import groovy.json.JsonOutput
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.Instant
import java.time.format.DateTimeFormatter

/**
 * SAP CPI iFlow Script: Prepare Position Filter
 *
 * Filtert FODepartment und FODivision (SuccessFactors OData V2):
 * - Nur Zeitabschnitte mit effectiveEndDate >= heute (gültig heute oder zukünftig)
 * - Nur Zeitabschnitte mit effectiveStatus = 'A' (aktiv)
 * - Nur Zeitabschnitte mit nicht-leerem cust_HRM
 *
 * Baut einen OData $filter für Position anhand der ermittelten
 * Department-/Division-Codes (direkte FK-Felder auf Position).
 *
 * Voraussetzung: Departments und Divisions werden in separaten iFlow-Schritten
 * abgefragt und als Properties übergeben, ODER als kombinierter Payload.
 *
 * Erwartete OData-Abfragen im iFlow (vor diesem Skript):
 *   FODepartment?$filter=effectiveEndDate ge datetime'...'&$select=externalCode,effectiveStartDate,effectiveEndDate,cust_HRM,effectiveStatus,name
 *   FODivision?$filter=effectiveEndDate ge datetime'...'&$select=externalCode,effectiveStartDate,effectiveEndDate,cust_HRM,effectiveStatus,name
 */
def Message processData(Message message) {

    def messageLog = messageLogFactory.getMessageLog(message)

    def body = message.getBody(String)
    def jsonSlurper = new JsonSlurper()

    def today = LocalDate.now()
    def todayStr = today.format(DateTimeFormatter.ISO_DATE)

    // -----------------------------------------------------------------
    // SuccessFactors OData V2 Datumsparser: /Date(millis)/ -> LocalDate
    // SF verwendet UTC für alle Datumsfelder
    // -----------------------------------------------------------------
    def parseSfDate = { String dateStr ->
        if (dateStr == null || dateStr.trim().isEmpty()) {
            return null
        }
        def matcher = (dateStr =~ /\/Date\((\-?\d+)\)\//)
        if (matcher.find()) {
            long millis = Long.parseLong(matcher.group(1))
            return Instant.ofEpochMilli(millis)
                .atZone(ZoneOffset.UTC)
                .toLocalDate()
        }
        // Fallback: ISO-Datum (z.B. aus manuellem Testing)
        try {
            return LocalDate.parse(dateStr, DateTimeFormatter.ISO_DATE)
        } catch (Exception e) {
            messageLog.addAttachmentAsString("DateParseWarning",
                "Konnte Datum nicht parsen: ${dateStr}", "text/plain")
            return null
        }
    }

    // -----------------------------------------------------------------
    // Payload parsen: Unterstützt mehrere Strukturen
    // Variante 1: Property-basiert (Departments und Divisions separat)
    // Variante 2: Kombinierter Payload mit Keys
    // Variante 3: Direkter OData-Response (d.results)
    // -----------------------------------------------------------------
    def departmentsRaw = []
    def divisionsRaw = []

    // Prüfe ob Departments/Divisions als Properties vorliegen
    def deptProperty = message.getProperty("departmentsPayload")
    def divProperty = message.getProperty("divisionsPayload")

    if (deptProperty != null && divProperty != null) {
        def deptPayload = jsonSlurper.parseText(deptProperty.toString())
        def divPayload = jsonSlurper.parseText(divProperty.toString())
        departmentsRaw = deptPayload.d?.results ?: []
        divisionsRaw = divPayload.d?.results ?: []
    } else {
        def payload = jsonSlurper.parseText(body)
        if (payload.departments != null && payload.divisions != null) {
            departmentsRaw = payload.departments?.d?.results ?: []
            divisionsRaw = payload.divisions?.d?.results ?: []
        } else {
            // Einzelner Payload — Typ über Property bestimmen
            def entityType = message.getProperty("currentEntityType")?.toString()
            def results = payload.d?.results ?: []
            if (entityType == "FODivision") {
                divisionsRaw = results
            } else {
                departmentsRaw = results
            }
        }
    }

    messageLog.addAttachmentAsString("InputCounts",
        "Departments: ${departmentsRaw.size()}, Divisions: ${divisionsRaw.size()}",
        "text/plain")

    // -----------------------------------------------------------------
    // FODepartment filtern
    // Kriterien:
    //   - effectiveEndDate >= heute (gültig heute oder in Zukunft)
    //   - effectiveStatus == 'A' (aktiv)
    //   - cust_HRM ist nicht leer
    // -----------------------------------------------------------------
    def filteredDepartments = []

    departmentsRaw.each { dept ->
        def endDate = parseSfDate(dept.effectiveEndDate)
        def startDate = parseSfDate(dept.effectiveStartDate)
        def status = dept.effectiveStatus?.toString()?.trim()
        def custHRM = dept.cust_HRM?.toString()?.trim()

        if (endDate == null) {
            return // skip — kein gültiges Enddatum
        }

        // endDate >= heute: Datensatz ist heute gültig oder liegt in der Zukunft
        boolean isCurrentOrFuture = !endDate.isBefore(today)
        boolean isActive = (status == "A")
        boolean hasHRM = (custHRM != null && !custHRM.isEmpty())

        if (isCurrentOrFuture && isActive && hasHRM) {
            filteredDepartments << [
                externalCode       : dept.externalCode,
                effectiveStartDate : dept.effectiveStartDate,
                effectiveEndDate   : dept.effectiveEndDate,
                cust_HRM           : custHRM,
                name               : dept.name_defaultValue ?: dept.name
            ]
        }
    }

    // -----------------------------------------------------------------
    // FODivision filtern (gleiche Kriterien)
    // -----------------------------------------------------------------
    def filteredDivisions = []

    divisionsRaw.each { div ->
        def endDate = parseSfDate(div.effectiveEndDate)
        def startDate = parseSfDate(div.effectiveStartDate)
        def status = div.effectiveStatus?.toString()?.trim()
        def custHRM = div.cust_HRM?.toString()?.trim()

        if (endDate == null) {
            return
        }

        boolean isCurrentOrFuture = !endDate.isBefore(today)
        boolean isActive = (status == "A")
        boolean hasHRM = (custHRM != null && !custHRM.isEmpty())

        if (isCurrentOrFuture && isActive && hasHRM) {
            filteredDivisions << [
                externalCode       : div.externalCode,
                effectiveStartDate : div.effectiveStartDate,
                effectiveEndDate   : div.effectiveEndDate,
                cust_HRM           : custHRM,
                name               : div.name_defaultValue ?: div.name
            ]
        }
    }

    messageLog.addAttachmentAsString("FilteredCounts",
        "Filtered Departments: ${filteredDepartments.size()}, " +
        "Filtered Divisions: ${filteredDivisions.size()}", "text/plain")

    // -----------------------------------------------------------------
    // Eindeutige externalCodes sammeln
    // -----------------------------------------------------------------
    def uniqueDeptCodes = filteredDepartments.collect { it.externalCode }.unique()
    def uniqueDivCodes = filteredDivisions.collect { it.externalCode }.unique()

    // -----------------------------------------------------------------
    // OData $filter für Position aufbauen
    //
    // SAP SuccessFactors Position hat die direkten FK-Felder:
    //   - department (String) -> verweist auf FODepartment.externalCode
    //   - division (String)   -> verweist auf FODivision.externalCode
    //
    // WICHTIG: In SF OData V2 wird NICHT über Navigationseigenschaften
    // gefiltert (kein departmentNav/externalCode), sondern über die
    // direkten Fremdschlüssel-Felder auf der Position-Entität.
    // -----------------------------------------------------------------
    def filterParts = []

    uniqueDeptCodes.each { code ->
        filterParts << "department eq '${code}'"
    }

    uniqueDivCodes.each { code ->
        filterParts << "division eq '${code}'"
    }

    def positionFilter = ""
    if (!filterParts.isEmpty()) {
        // Gruppierung: (dept1 or dept2) or (div1 or div2)
        def deptFilters = uniqueDeptCodes.collect { "department eq '${it}'" }
        def divFilters = uniqueDivCodes.collect { "division eq '${it}'" }

        def parts = []
        if (!deptFilters.isEmpty()) {
            parts << (deptFilters.size() > 1 ? "(${deptFilters.join(' or ')})" : deptFilters[0])
        }
        if (!divFilters.isEmpty()) {
            parts << (divFilters.size() > 1 ? "(${divFilters.join(' or ')})" : divFilters[0])
        }
        positionFilter = parts.join(" or ")
    }

    // -----------------------------------------------------------------
    // OData $expand für den Position-Request
    // DepartmentNav und DivisionNav werden benötigt, um im zweiten Skript
    // die cust_HRM-Zuordnung über die Navigation zu validieren
    // -----------------------------------------------------------------
    def positionExpand = "departmentNav,divisionNav,positionMatrixRelationshipNav"
    def positionSelect = "code,effectiveStartDate,effectiveEndDate,department,division,externalName_defaultValue"

    // -----------------------------------------------------------------
    // Ergebnisse in Properties speichern
    // -----------------------------------------------------------------
    message.setProperty("filteredDepartments", JsonOutput.toJson(filteredDepartments))
    message.setProperty("filteredDivisions", JsonOutput.toJson(filteredDivisions))
    message.setProperty("positionFilter", positionFilter)
    message.setProperty("positionExpand", positionExpand)
    message.setProperty("positionSelect", positionSelect)
    message.setProperty("uniqueDeptCodes", JsonOutput.toJson(uniqueDeptCodes))
    message.setProperty("uniqueDivCodes", JsonOutput.toJson(uniqueDivCodes))

    // -----------------------------------------------------------------
    // Timeline-Zuordnung: externalCode -> sortierte Zeitabschnitte
    // Wird im UpsertPositionMatrixRelationship-Skript benötigt
    // -----------------------------------------------------------------
    def deptHrmTimeline = [:]
    filteredDepartments.each { dept ->
        def code = dept.externalCode
        if (!deptHrmTimeline.containsKey(code)) {
            deptHrmTimeline[code] = []
        }
        deptHrmTimeline[code] << [
            effectiveStartDate : dept.effectiveStartDate,
            effectiveEndDate   : dept.effectiveEndDate,
            cust_HRM           : dept.cust_HRM
        ]
    }
    // Nach effectiveStartDate sortieren
    deptHrmTimeline.each { code, slices ->
        slices.sort { a, b ->
            def aDate = parseSfDate(a.effectiveStartDate)
            def bDate = parseSfDate(b.effectiveStartDate)
            return (aDate ?: LocalDate.MIN).compareTo(bDate ?: LocalDate.MIN)
        }
    }

    def divHrmTimeline = [:]
    filteredDivisions.each { div ->
        def code = div.externalCode
        if (!divHrmTimeline.containsKey(code)) {
            divHrmTimeline[code] = []
        }
        divHrmTimeline[code] << [
            effectiveStartDate : div.effectiveStartDate,
            effectiveEndDate   : div.effectiveEndDate,
            cust_HRM           : div.cust_HRM
        ]
    }
    divHrmTimeline.each { code, slices ->
        slices.sort { a, b ->
            def aDate = parseSfDate(a.effectiveStartDate)
            def bDate = parseSfDate(b.effectiveStartDate)
            return (aDate ?: LocalDate.MIN).compareTo(bDate ?: LocalDate.MIN)
        }
    }

    message.setProperty("deptHrmTimeline", JsonOutput.toJson(deptHrmTimeline))
    message.setProperty("divHrmTimeline", JsonOutput.toJson(divHrmTimeline))

    // Body = OData-Filterstring für den nächsten Request-Step (Position-Abfrage)
    message.setBody(positionFilter)

    messageLog.addAttachmentAsString("PositionFilter", positionFilter, "text/plain")
    messageLog.addAttachmentAsString("DeptTimeline",
        JsonOutput.prettyPrint(JsonOutput.toJson(deptHrmTimeline)), "application/json")
    messageLog.addAttachmentAsString("DivTimeline",
        JsonOutput.prettyPrint(JsonOutput.toJson(divHrmTimeline)), "application/json")

    return message
}
