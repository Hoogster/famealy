import com.sap.gateway.ip.core.customdev.util.Message
import groovy.json.JsonSlurper
import groovy.json.JsonOutput
import java.time.LocalDate
import java.time.ZoneId

/**
 * SAP CPI iFlow Script: Upsert cust_HRM in PositionMatrixRelationship
 *
 * Übernimmt den cust_HRM-Wert aus den Departements/Divisions und upsertet ihn
 * auf alle relevanten Zeitabschnitte der zugehörigen Positions in deren
 * PositionMatrixRelationship.
 *
 * Berücksichtigt zukünftige Änderungen: Wenn sich cust_HRM auf einem Department
 * per z.B. 01.04.2026 ändert, wird dies zeitabschnittsgenau auf der Position
 * abgebildet.
 */
def Message processData(Message message) {

    def body = message.getBody(String)
    def jsonSlurper = new JsonSlurper()

    // Positions mit ihren PositionMatrixRelationships aus dem Body lesen
    def positionsPayload = jsonSlurper.parseText(body)
    def positions = positionsPayload.d?.results ?: []

    // Timelines aus den Properties (vom PreparePositionFilter-Skript gesetzt)
    def deptHrmTimeline = jsonSlurper.parseText(
        message.getProperty("deptHrmTimeline")?.toString() ?: "{}"
    )
    def divHrmTimeline = jsonSlurper.parseText(
        message.getProperty("divHrmTimeline")?.toString() ?: "{}"
    )

    def today = LocalDate.now()

    // SuccessFactors OData V2 Datumsparser
    def parsesfDate = { String dateStr ->
        if (dateStr == null || dateStr.trim().isEmpty()) {
            return null
        }
        def matcher = (dateStr =~ /\/Date\((\-?\d+)\)\//)
        if (matcher.find()) {
            long millis = Long.parseLong(matcher.group(1))
            return java.time.Instant.ofEpochMilli(millis)
                .atZone(ZoneId.systemDefault())
                .toLocalDate()
        }
        try {
            return LocalDate.parse(dateStr)
        } catch (Exception e) {
            return null
        }
    }

    // Hilfsfunktion: LocalDate -> SuccessFactors /Date(millis)/ Format
    def tosfDate = { LocalDate date ->
        if (date == null) return null
        long millis = date.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        return "/Date(${millis})/"
    }

    // ---------------------------------------------------------------
    // Für jede Position den passenden cust_HRM-Wert ermitteln
    // und PositionMatrixRelationship-Upserts vorbereiten
    // ---------------------------------------------------------------
    def upsertPayloads = []

    positions.each { position ->
        def positionCode = position.code
        def positionStartDate = parsesfDate(position.effectiveStartDate)
        def positionEndDate = parsesfDate(position.effectiveEndDate)

        // Department und Division der Position auslesen
        def deptCode = position.department
        def divCode = position.division

        // cust_HRM-Timeline für dieses Department und Division holen
        def deptTimeline = deptHrmTimeline[deptCode] ?: []
        def divTimeline = divHrmTimeline[divCode] ?: []

        // Alle relevanten Zeitabschnitte der Position ermitteln
        // (heute und Zukunft)
        def positionMatrixRels = position.positionMatrixRelationshipNav?.results ?: []

        // ---------------------------------------------------------------
        // Zeitabschnitte aus Department-Timeline auf Position mappen
        // ---------------------------------------------------------------
        deptTimeline.each { deptSlice ->
            def deptStart = parsesfDate(deptSlice.startDate)
            def deptEnd = parsesfDate(deptSlice.endDate)
            def custHRM = deptSlice.cust_HRM

            if (deptStart == null || custHRM == null || custHRM.toString().trim().isEmpty()) {
                return // continue
            }

            // Nur Zeitabschnitte ab heute berücksichtigen
            if (deptEnd != null && deptEnd.isBefore(today)) {
                return // continue
            }

            // Effektives Startdatum: Maximum aus Dept-Start und heute
            def effectiveStart = deptStart.isBefore(today) ? today : deptStart

            // Prüfen ob für diesen Zeitabschnitt bereits ein
            // PositionMatrixRelationship existiert (Update) oder neu (Insert)
            def existingRel = positionMatrixRels.find { rel ->
                def relStart = parsesfDate(rel.effectiveStartDate)
                def relType = rel.matrixRelationshipType
                return relStart != null && relStart == effectiveStart &&
                       relType == "cust_HRM_Department"
            }

            def upsertEntry = [
                Position_code               : positionCode,
                Position_effectiveStartDate : tosfDate(effectiveStart),
                matrixRelationshipType      : "cust_HRM_Department",
                cust_HRM                    : custHRM,
                effectiveStartDate          : tosfDate(effectiveStart),
                effectiveEndDate            : deptSlice.endDate,
                __operation                 : existingRel ? "UPDATE" : "INSERT"
            ]

            // Bei Update die bestehende Relationship-ID mitgeben
            if (existingRel) {
                upsertEntry["Position_externalCode"] = existingRel.Position_externalCode
            }

            upsertPayloads << upsertEntry
        }

        // ---------------------------------------------------------------
        // Zeitabschnitte aus Division-Timeline auf Position mappen
        // ---------------------------------------------------------------
        divTimeline.each { divSlice ->
            def divStart = parsesfDate(divSlice.startDate)
            def divEnd = parsesfDate(divSlice.endDate)
            def custHRM = divSlice.cust_HRM

            if (divStart == null || custHRM == null || custHRM.toString().trim().isEmpty()) {
                return // continue
            }

            if (divEnd != null && divEnd.isBefore(today)) {
                return // continue
            }

            def effectiveStart = divStart.isBefore(today) ? today : divStart

            def existingRel = positionMatrixRels.find { rel ->
                def relStart = parsesfDate(rel.effectiveStartDate)
                def relType = rel.matrixRelationshipType
                return relStart != null && relStart == effectiveStart &&
                       relType == "cust_HRM_Division"
            }

            def upsertEntry = [
                Position_code               : positionCode,
                Position_effectiveStartDate : tosfDate(effectiveStart),
                matrixRelationshipType      : "cust_HRM_Division",
                cust_HRM                    : custHRM,
                effectiveStartDate          : tosfDate(effectiveStart),
                effectiveEndDate            : divSlice.endDate,
                __operation                 : existingRel ? "UPDATE" : "INSERT"
            ]

            if (existingRel) {
                upsertEntry["Position_externalCode"] = existingRel.Position_externalCode
            }

            upsertPayloads << upsertEntry
        }

        // ---------------------------------------------------------------
        // Zukünftige Änderungen: Zeitabschnitte splitten falls nötig
        // Wenn ein Positions-Zeitabschnitt über eine cust_HRM-Änderung
        // hinausgeht, muss an der Änderungsgrenze gesplittet werden
        // ---------------------------------------------------------------
        def allTimelineSlices = []
        allTimelineSlices.addAll(deptTimeline.collect { it + [source: "Department"] })
        allTimelineSlices.addAll(divTimeline.collect { it + [source: "Division"] })

        // Sortiere nach Startdatum
        allTimelineSlices.sort { a, b ->
            def aStart = parsesfDate(a.startDate)
            def bStart = parsesfDate(b.startDate)
            if (aStart == null && bStart == null) return 0
            if (aStart == null) return -1
            if (bStart == null) return 1
            return aStart.compareTo(bStart)
        }

        // Übergangs-Upserts: Wenn sich cust_HRM zwischen zwei
        // aufeinanderfolgenden Zeitabschnitten ändert
        def prevSlicesBySource = [:]
        allTimelineSlices.each { slice ->
            def source = slice.source
            def prevSlice = prevSlicesBySource[source]

            if (prevSlice != null) {
                def prevHRM = prevSlice.cust_HRM?.toString()?.trim()
                def currHRM = slice.cust_HRM?.toString()?.trim()
                def currStart = parsesfDate(slice.startDate)

                // Wenn sich cust_HRM ändert und das Änderungsdatum in der
                // Zukunft liegt, einen expliziten Übergangs-Upsert erstellen
                if (prevHRM != currHRM && currStart != null && !currStart.isBefore(today)) {
                    def relType = source == "Department" ?
                        "cust_HRM_Department" : "cust_HRM_Division"

                    // Prüfen ob nicht bereits ein Upsert für dieses Datum existiert
                    def alreadyExists = upsertPayloads.any { p ->
                        p.Position_code == positionCode &&
                        p.matrixRelationshipType == relType &&
                        p.effectiveStartDate == tosfDate(currStart)
                    }

                    if (!alreadyExists) {
                        upsertPayloads << [
                            Position_code               : positionCode,
                            Position_effectiveStartDate : tosfDate(currStart),
                            matrixRelationshipType      : relType,
                            cust_HRM                    : currHRM,
                            effectiveStartDate          : tosfDate(currStart),
                            effectiveEndDate            : slice.endDate,
                            __operation                 : "UPSERT"
                        ]
                    }
                }
            }
            prevSlicesBySource[source] = slice
        }
    }

    // ---------------------------------------------------------------
    // Ergebnis: Upsert-Payloads als Body setzen
    // ---------------------------------------------------------------
    def result = [
        totalPositions     : positions.size(),
        totalUpserts       : upsertPayloads.size(),
        upsertPayloads     : upsertPayloads
    ]

    message.setBody(JsonOutput.prettyPrint(JsonOutput.toJson(result)))
    message.setProperty("upsertCount", upsertPayloads.size().toString())

    return message
}
