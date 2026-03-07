import com.sap.gateway.ip.core.customdev.util.Message
import groovy.json.JsonSlurper
import groovy.json.JsonOutput
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.Instant

/**
 * SAP CPI iFlow Script: Upsert cust_HRM in PositionMatrixRelationship
 *
 * Übernimmt den cust_HRM-Wert aus den gefilterten FODepartment/FODivision-
 * Zeitabschnitten und generiert Upsert-Payloads für die zugehörigen
 * PositionMatrixRelationship-Einträge.
 *
 * Zeitabschnittslogik:
 * - Jeder Positions-Zeitabschnitt erhält den cust_HRM-Wert, der zum
 *   jeweiligen Zeitpunkt auf dem Department/Division gültig ist
 * - Zukünftige Änderungen werden berücksichtigt: Wenn cust_HRM auf einem
 *   Department per z.B. 01.04.2026 ändert, wird ein neuer Zeitabschnitt
 *   auf der PositionMatrixRelationship mit dem neuen Wert erstellt
 *
 * WICHTIG: Entity-Feldnamen:
 * - FODepartment/FODivision (FO-Entities): startDate, endDate
 * - Position (MDF-Entity): effectiveStartDate, effectiveEndDate
 * - PositionMatrixRelationship Key: Position_code, Position_effectiveStartDate, externalCode
 *
 * Voraussetzung: Position-Abfrage mit $expand=positionMatrixRelationshipNav
 *
 * Die generierten Upsert-Payloads werden anschliessend via SF OData V2
 * Adapter (UPSERT-Modus oder Batch) an SuccessFactors gesendet.
 */
def Message processData(Message message) {

    def messageLog = messageLogFactory.getMessageLog(message)

    def body = message.getBody(String)
    def jsonSlurper = new JsonSlurper()

    // Positions (MDF-Entity) mit PositionMatrixRelationships aus dem Body lesen
    def positionsPayload = jsonSlurper.parseText(body)
    def positions = positionsPayload.d?.results ?: []

    // Timelines aus Properties (vom PreparePositionFilter-Skript gesetzt)
    // Timeline-Felder verwenden FO-Feldnamen (startDate/endDate)
    def deptHrmTimeline = jsonSlurper.parseText(
        message.getProperty("deptHrmTimeline")?.toString() ?: "{}"
    )
    def divHrmTimeline = jsonSlurper.parseText(
        message.getProperty("divHrmTimeline")?.toString() ?: "{}"
    )

    def today = LocalDate.now()

    // -----------------------------------------------------------------
    // SuccessFactors OData V2 Datumskonvertierung (UTC)
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
        try {
            return LocalDate.parse(dateStr)
        } catch (Exception e) {
            return null
        }
    }

    def toSfDate = { LocalDate date ->
        if (date == null) return null
        long millis = date.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
        return "/Date(${millis})/"
    }

    // -----------------------------------------------------------------
    // Für jede Position die cust_HRM-Upserts vorbereiten
    // -----------------------------------------------------------------
    def upsertPayloads = []
    def processedPositions = 0
    def skippedPositions = 0

    positions.each { position ->
        def positionCode = position.code
        def deptCode = position.department
        def divCode = position.division

        if (positionCode == null) {
            skippedPositions++
            return // skip
        }

        // Timeline für das Department/Division dieser Position
        def deptTimeline = deptHrmTimeline[deptCode] ?: []
        def divTimeline = divHrmTimeline[divCode] ?: []

        if (deptTimeline.isEmpty() && divTimeline.isEmpty()) {
            skippedPositions++
            return // skip — keine relevanten Timelines
        }

        // Bestehende PositionMatrixRelationships laden
        def existingRels = position.positionMatrixRelationshipNav?.results ?: []

        // =============================================================
        // Department cust_HRM -> PositionMatrixRelationship
        // =============================================================
        if (!deptTimeline.isEmpty()) {
            processTimelineForPosition(
                deptTimeline, existingRels, positionCode, position,
                "department", today, parseSfDate, toSfDate, upsertPayloads
            )
        }

        // =============================================================
        // Division cust_HRM -> PositionMatrixRelationship
        // =============================================================
        if (!divTimeline.isEmpty()) {
            processTimelineForPosition(
                divTimeline, existingRels, positionCode, position,
                "division", today, parseSfDate, toSfDate, upsertPayloads
            )
        }

        processedPositions++
    }

    // -----------------------------------------------------------------
    // Ergebnis zusammenstellen
    // -----------------------------------------------------------------
    def result = [
        d: [
            results: upsertPayloads
        ],
        __metadata: [
            totalPositions    : positions.size(),
            processedPositions: processedPositions,
            skippedPositions  : skippedPositions,
            totalUpserts      : upsertPayloads.size(),
            generatedAt       : today.toString()
        ]
    ]

    message.setBody(JsonOutput.prettyPrint(JsonOutput.toJson(result)))
    message.setProperty("upsertCount", upsertPayloads.size().toString())
    message.setProperty("processedPositions", processedPositions.toString())

    if (messageLog != null) {
        messageLog.addAttachmentAsString("UpsertSummary",
            "Positions: ${processedPositions} verarbeitet, ${skippedPositions} übersprungen. " +
            "Upserts: ${upsertPayloads.size()}", "text/plain")
        messageLog.addAttachmentAsString("UpsertPayloads",
            JsonOutput.prettyPrint(JsonOutput.toJson(upsertPayloads)), "application/json")
    }

    return message
}

/**
 * Verarbeitet eine cust_HRM-Timeline (Department oder Division) und erstellt
 * die entsprechenden Upsert-Einträge für PositionMatrixRelationship.
 *
 * Logik für zukünftige Änderungen:
 * - Für jeden Zeitabschnitt in der Timeline, der ab heute gültig ist,
 *   wird ein separater Upsert-Eintrag erstellt
 * - Wenn sich cust_HRM zwischen aufeinanderfolgenden Zeitabschnitten ändert,
 *   wird an der Änderungsgrenze ein neuer Eintrag mit dem neuen Wert erstellt
 * - Bestehende PositionMatrixRelationship-Einträge werden als Update behandelt
 *
 * HINWEIS: Timeline-Daten stammen von FO-Entities und verwenden startDate/endDate.
 * PositionMatrixRelationship ist ein MDF-Sub-Entity und verwendet effectiveStartDate.
 *
 * PositionMatrixRelationship Compound Key:
 *   - Position_code (String)
 *   - Position_effectiveStartDate (/Date(millis)/)
 *   - externalCode (String, auto-generiert oder gesetzt)
 */
def processTimelineForPosition(
    List timeline, List existingRels, String positionCode, Map position,
    String source, LocalDate today, Closure parseSfDate, Closure toSfDate,
    List upsertPayloads
) {
    // matrixRelationshipType gemäss Kundenfeld-Konvention
    def relType = "cust_HRM"

    timeline.each { slice ->
        // FO-Entity Feldnamen: startDate, endDate
        def sliceStart = parseSfDate(slice.startDate)
        def sliceEnd = parseSfDate(slice.endDate)
        def custHRM = slice.cust_HRM?.toString()?.trim()

        if (sliceStart == null || custHRM == null || custHRM.isEmpty()) {
            return // skip
        }

        // Nur Zeitabschnitte ab heute berücksichtigen
        if (sliceEnd != null && sliceEnd.isBefore(today)) {
            return // skip — liegt komplett in der Vergangenheit
        }

        // Effektives Startdatum: Maximum aus Slice-Start und heute
        // Für den aktuell gültigen Zeitabschnitt setzen wir heute als Start
        def effectiveStart = sliceStart.isBefore(today) ? today : sliceStart

        // Prüfe ob bereits ein PositionMatrixRelationship-Eintrag
        // für diesen Zeitabschnitt existiert
        // Key-Match über: Position_code + effectiveStartDate + matrixRelationshipType
        def existingRel = existingRels.find { rel ->
            def relStart = parseSfDate(rel.effectiveStartDate)
            return relStart != null &&
                   relStart == effectiveStart &&
                   rel.matrixRelationshipType == relType
        }

        // Upsert-Payload gemäss SF OData V2 Entity-Struktur
        // PositionMatrixRelationship Compound Key:
        //   - Position_code
        //   - Position_effectiveStartDate
        //   - externalCode (wird bei Insert auto-generiert, bei Update aus bestehendem Eintrag)
        def upsertEntry = [
            __metadata: [
                uri : existingRel?.__metadata?.uri ?: "PositionMatrixRelationship",
                type: "SFOData.PositionMatrixRelationship"
            ],
            Position_code              : positionCode,
            Position_effectiveStartDate: toSfDate(effectiveStart),
            matrixRelationshipType     : relType,
            cust_HRM                   : custHRM
        ]

        // Bei bestehendem Eintrag: externalCode für Key-Auflösung übernehmen
        if (existingRel != null) {
            upsertEntry.externalCode = existingRel.externalCode
        }

        upsertPayloads << upsertEntry
    }
}
