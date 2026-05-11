/**
 * German translation map — Part 1.
 * Covers: Auth, Dashboard, Settings (expiryReminders, approvals, reminderRules,
 * notifications, integrations, provider, branding, changeRequest, carriers,
 * returnCarrier).
 */

export const TRANSLATIONS_PART1: Record<string, string> = {
  // ─── Auth ──────────────────────────────────────────────────────────────────
  'Auth.invite.title': '{orgName} beitreten',

  // ─── Dashboard ─────────────────────────────────────────────────────────────
  'Dashboard.deadlines.overdue': 'Seit {days} Tagen überfällig',
  'Dashboard.deadlines.upcoming': 'In {days} Tagen',
  'Dashboard.activity.resources.workflowTemplate': 'Workflow-Vorlage',
  'Dashboard.activity.resources.approvalStep': 'Freigabestufe',

  // ─── Settings.expiryReminders ──────────────────────────────────────────────
  'Settings.expiryReminders.heading': 'Erinnerungen zum Vertragsablauf',
  'Settings.expiryReminders.description':
    'Standardintervalle für Erinnerungen bei allen Verträgen. Einzelne Verträge können diese überschreiben.',
  'Settings.expiryReminders.label': 'Tage vor Ablauf',
  'Settings.expiryReminders.placeholder': 'z. B. 30, 60, 90',
  'Settings.expiryReminders.successToast': 'Standard-Erinnerungen aktualisiert',

  // ─── Settings (invoice / approvals top-level) ──────────────────────────────
  'Settings.invoiceEmailInbox': 'E-Mail-Posteingang für Rechnungen',
  'Settings.invoiceEmailBody':
    'Rechnungen, die an diese Adresse gesendet werden, werden automatisch als Entwürfe importiert.',
  'Settings.copyEmail': 'E-Mail-Adresse kopieren',
  'Settings.emailCopied': 'E-Mail-Adresse kopiert',
  'Settings.deviationThreshold': 'Abweichungsschwelle (%)',
  'Settings.deviationThresholdHelp':
    'Rechnungen markieren, wenn der Betrag um mehr als diesen Prozentsatz vom Vertragssatz abweicht.',
  'Settings.invoiceSettingsSaved': 'Rechnungseinstellungen gespeichert',

  // ─── Settings.approvals ────────────────────────────────────────────────────
  'Settings.approvals.heading': 'Freigabeketten',
  'Settings.approvals.description':
    'Konfigurieren Sie Freigabeketten für Rechnungen. Ketten werden anhand von Bedingungen wie Betragsschwellen zugeordnet.',
  'Settings.approvals.createChain': 'Freigabekette erstellen',
  'Settings.approvals.levelsCount': '{n} Stufen',
  'Settings.approvals.conditionSummary': 'Betrag {operator} {value} {currency}',
  'Settings.approvals.noConditions': 'Keine Bedingungen (Standard-Fallback)',
  'Settings.approvals.empty.heading': 'Keine Freigabeketten konfiguriert',
  'Settings.approvals.empty.body':
    'Erstellen Sie eine Freigabekette, um Rechnungen vor der Zahlung über mehrstufige Freigaben zu leiten.',
  'Settings.approvals.empty.cta': 'Freigabekette erstellen',
  'Settings.approvals.deleteConfirm.title': 'Diese Freigabekette löschen?',
  'Settings.approvals.deleteConfirm.body':
    'Die Kette wird endgültig gelöscht. Laufende Freigaben, die diese Kette verwenden, sind nicht betroffen.',
  'Settings.approvals.deleteConfirm.confirm': 'Kette löschen',
  'Settings.approvals.editor.createTitle': 'Freigabekette erstellen',
  'Settings.approvals.editor.editTitle': 'Freigabekette bearbeiten',
  'Settings.approvals.editor.createDescription':
    'Richten Sie eine neue Freigabekette mit Stufen und Routing-Bedingungen ein.',
  'Settings.approvals.editor.editDescription':
    'Aktualisieren Sie Ketteneinstellungen, Freigabestufen und Routing-Bedingungen.',
  'Settings.approvals.editor.chainName': 'Name der Kette',
  'Settings.approvals.editor.chainNamePlaceholder': 'z. B. Standard-Rechnungsfreigabe',
  'Settings.approvals.editor.defaultToggle': 'Als Standardkette festlegen',
  'Settings.approvals.editor.defaultHelp':
    'Die Standardkette wird verwendet, wenn keine Bedingungen zutreffen.',
  'Settings.approvals.editor.levelsHeading': 'Freigabestufen',
  'Settings.approvals.editor.levelName': 'Stufenname',
  'Settings.approvals.editor.levelNamePlaceholder': 'z. B. Manager-Prüfung',
  'Settings.approvals.editor.approverUser': 'Bestimmter Benutzer',
  'Settings.approvals.editor.userPlaceholder': 'Benutzer suchen ...',
  'Settings.approvals.editor.rolePlaceholder': 'Rolle auswählen ...',
  'Settings.approvals.editor.slaHours': 'SLA (Stunden)',
  'Settings.approvals.editor.slaPlaceholder': 'z. B. 24',
  'Settings.approvals.editor.addLevel': 'Stufe hinzufügen',
  'Settings.approvals.editor.removeLevel': 'Stufe entfernen',
  'Settings.approvals.editor.maxLevels': 'Maximal 3 Stufen erreicht',
  'Settings.approvals.editor.conditionsHeading': 'Routing-Bedingungen',
  'Settings.approvals.editor.conditionsHelp':
    'Wenn eine Rechnung diese Bedingungen erfüllt, wird diese Kette verwendet. Lassen Sie das Feld leer für die Standardkette.',
  'Settings.approvals.editor.conditionField': 'Feld auswählen ...',
  'Settings.approvals.editor.conditionOperator': 'Operator auswählen ...',
  'Settings.approvals.editor.conditionValue': 'Wert eingeben ...',
  'Settings.approvals.editor.fieldContractorType': 'Auftragnehmertyp',
  'Settings.approvals.editor.operatorGt': 'Größer als',
  'Settings.approvals.editor.operatorLt': 'Kleiner als',
  'Settings.approvals.editor.addCondition': 'Bedingung hinzufügen',
  'Settings.approvals.editor.save': 'Kette speichern',
  'Settings.approvals.editor.noUsersFound': 'Keine Benutzer gefunden.',
  'Settings.approvals.toasts.created': 'Freigabekette erstellt',
  'Settings.approvals.toasts.updated': 'Freigabekette aktualisiert',
  'Settings.approvals.toasts.deleted': 'Freigabekette gelöscht',
  'Settings.approvals.validation.chainNameRequired': 'Name der Kette ist erforderlich',
  'Settings.approvals.validation.chainNameMax':
    'Name der Kette darf höchstens 100 Zeichen lang sein',
  'Settings.approvals.validation.levelNameRequired': 'Stufenname ist erforderlich',
  'Settings.approvals.validation.approverRequired': 'Wählen Sie einen Freigeber aus',
  'Settings.approvals.validation.slaRequired': 'SLA muss eine positive Zahl sein',
  'Settings.approvals.validation.slaRange': 'SLA muss zwischen 1 und 720 Stunden liegen',
  'Settings.approvals.validation.minOneLevel': 'Fügen Sie mindestens eine Freigabestufe hinzu',

  // ─── Settings.notifications ────────────────────────────────────────────────
  'Settings.notifications.heading': 'Benachrichtigungseinstellungen',
  'Settings.notifications.description':
    'Wählen Sie aus, wie Sie für jeden Ereignistyp benachrichtigt werden möchten. In-App-Benachrichtigungen sind immer aktiviert.',
  'Settings.notifications.inAppTooltip': 'In-App-Benachrichtigungen sind immer aktiviert',
  'Settings.notifications.slackDisabledTooltip':
    'Verbinden Sie Slack unter Integrationen, um diese Option zu aktivieren',
  'Settings.notifications.eventApprovalRequest': 'Freigabe angefragt',
  'Settings.notifications.eventApprovalDecision': 'Freigabeentscheidung',
  'Settings.notifications.eventTaskAssigned': 'Aufgabe zugewiesen',
  'Settings.notifications.eventTaskOverdue': 'Aufgabe überfällig',
  'Settings.notifications.eventContractExpiring': 'Vertrag läuft ab',
  'Settings.notifications.eventInvoiceReceived': 'Rechnung erhalten',
  'Settings.notifications.savePreferences': 'Einstellungen speichern',
  'Settings.notifications.preferencesSaved': 'Benachrichtigungseinstellungen gespeichert',
  'Settings.notifications.teamsDisabledTooltip':
    'Verbinden Sie Microsoft Teams unter Integrationen, um Teams-Benachrichtigungen zu aktivieren.',

  // ─── Settings.reminderRules ────────────────────────────────────────────────
  'Settings.reminderRules.heading': 'Benutzerdefinierte Erinnerungsregeln',
  'Settings.reminderRules.description':
    'Automatisieren Sie Erinnerungen für Vertragsablauf, Aufgabenfristen und andere wiederkehrende Ereignisse.',
  'Settings.reminderRules.createRule': 'Regel erstellen',
  'Settings.reminderRules.emptyHeading': 'Keine Erinnerungsregeln',
  'Settings.reminderRules.emptyBody':
    'Erstellen Sie benutzerdefinierte Regeln, um automatische Erinnerungen für Vertragsablauf, Aufgabenfristen und andere Ereignisse zu versenden.',
  'Settings.reminderRules.emptyCta': 'Regel erstellen',
  'Settings.reminderRules.ruleDescription':
    '{offsetDays} Tage vor {triggerType}, Empfänger {recipientMode} via {channel} benachrichtigen',
  'Settings.reminderRules.deleteConfirm.title': 'Diese Erinnerungsregel löschen?',
  'Settings.reminderRules.deleteConfirm.body':
    'Die Regel wird endgültig gelöscht. Ausstehende Erinnerungen aus dieser Regel werden abgebrochen.',
  'Settings.reminderRules.deleteConfirm.confirm': 'Regel löschen',
  'Settings.reminderRules.toasts.created': 'Erinnerungsregel erstellt',
  'Settings.reminderRules.toasts.updated': 'Erinnerungsregel aktualisiert',
  'Settings.reminderRules.toasts.deleted': 'Erinnerungsregel gelöscht',
  'Settings.reminderRules.toasts.toggled': 'Erinnerungsregel aktualisiert',
  'Settings.reminderRules.editor.createTitle': 'Erinnerungsregel erstellen',
  'Settings.reminderRules.editor.editTitle': 'Erinnerungsregel bearbeiten',
  'Settings.reminderRules.editor.ruleName': 'Regelname',
  'Settings.reminderRules.editor.ruleNamePlaceholder': 'z. B. Erinnerung Vertragsablauf',
  'Settings.reminderRules.editor.triggerBeforeContractEnd': 'Vor Vertragsende',
  'Settings.reminderRules.editor.triggerBeforeDueDate': 'Vor Fälligkeit',
  'Settings.reminderRules.editor.triggerAfterDueDate': 'Nach Fälligkeit',
  'Settings.reminderRules.editor.triggerBeforeDocumentExpiry': 'Vor Dokumentenablauf',
  'Settings.reminderRules.editor.triggerOnLifecycleChange': 'Bei Lebenszyklusänderung',
  'Settings.reminderRules.editor.triggerOnDueDate': 'Am Fälligkeitstag',
  'Settings.reminderRules.editor.offsetDaysPlaceholder': 'Tage vorher',
  'Settings.reminderRules.editor.entityType': 'Gilt für',
  'Settings.reminderRules.editor.channel': 'Senden über',
  'Settings.reminderRules.editor.recipientEntityOwner': 'Verantwortlicher',
  'Settings.reminderRules.editor.recipientFinanceTeam': 'Finanzteam',
  'Settings.reminderRules.editor.recipientSpecificUser': 'Bestimmter Benutzer',
  'Settings.reminderRules.editor.userPlaceholder': 'Benutzer suchen ...',
  'Settings.reminderRules.editor.rolePlaceholder': 'Rolle auswählen ...',
  'Settings.reminderRules.editor.save': 'Regel speichern',
  'Settings.reminderRules.editor.noUsersFound': 'Keine Benutzer gefunden.',
  'Settings.reminderRules.validation.ruleNameRequired': 'Regelname ist erforderlich',
  'Settings.reminderRules.validation.ruleNameMax': 'Regelname darf höchstens 100 Zeichen lang sein',
  'Settings.reminderRules.validation.triggerRequired': 'Wählen Sie einen Auslösertyp aus',
  'Settings.reminderRules.validation.offsetRequired': 'Versatz muss eine positive Zahl sein',
  'Settings.reminderRules.validation.offsetRange': 'Versatz muss zwischen 1 und 365 Tagen liegen',
  'Settings.reminderRules.validation.channelRequired':
    'Wählen Sie einen Benachrichtigungskanal aus',
  'Settings.reminderRules.validation.recipientRequired':
    'Wählen Sie aus, wer benachrichtigt werden soll',
  'Settings.reminderRules.validation.userRequired': 'Wählen Sie einen Benutzer aus',
  'Settings.reminderRules.validation.roleRequired': 'Wählen Sie eine Rolle aus',

  // ─── Settings.integrations ────────────────────────────────────────────────
  'Settings.integrations.description':
    'Verbinden Sie externe Dienste, um Benachrichtigungen und Workflows zu erweitern.',
  'Settings.integrations.slack.descriptionDisconnected':
    'Verbinden Sie Ihren Slack-Workspace, um Freigabeanfragen als Direktnachrichten zu erhalten und Rechnungen direkt aus Slack heraus freizugeben.',
  'Settings.integrations.slack.connectedTo': 'Verbunden mit',
  'Settings.integrations.slack.connectedBy': 'Verbunden von',
  'Settings.integrations.slack.connectedOn': 'Verbunden am',
  'Settings.integrations.slack.disconnectCta': 'Slack trennen',
  'Settings.integrations.slack.reconnectCta': 'Slack erneut verbinden',
  'Settings.integrations.slack.statusDisconnected': 'Nicht verbunden',
  'Settings.integrations.slack.statusError': 'Verbindungsfehler',
  'Settings.integrations.slack.statusReauth': 'Erneute Authentifizierung erforderlich',
  'Settings.integrations.userMapping.heading': 'Benutzerzuordnung',
  'Settings.integrations.userMapping.description':
    'Slack-Benutzer werden automatisch anhand der E-Mail-Adresse zugeordnet. Verknüpfen Sie nicht zugeordnete Benutzer unten manuell.',
  'Settings.integrations.userMapping.columnSlackUser': 'Slack-Benutzer',
  'Settings.integrations.userMapping.statusManuallyLinked': 'Manuell verknüpft',
  'Settings.integrations.userMapping.linkUser': 'Benutzer verknüpfen',
  'Settings.integrations.userMapping.unlinkUser': 'Verknüpfung aufheben',
  'Settings.integrations.userMapping.searchPlaceholder': 'Slack-Benutzer suchen ...',
  'Settings.integrations.userMapping.mappingStats': '{matched} von {total} Benutzern zugeordnet',
  'Settings.integrations.disconnectConfirm.title': 'Slack trennen?',
  'Settings.integrations.disconnectConfirm.body':
    'Dies deaktiviert Slack-Benachrichtigungen und Freigabeaktionen für alle Benutzer. Sie können die Verbindung später wiederherstellen.',
  'Settings.integrations.disconnectConfirm.confirm': 'Slack trennen',
  'Settings.integrations.toasts.connected': 'Slack-Workspace verbunden',
  'Settings.integrations.toasts.disconnected': 'Slack getrennt',
  'Settings.integrations.toasts.userLinked': 'Slack-Benutzer verknüpft',
  'Settings.integrations.toasts.userUnlinked': 'Slack-Benutzerverknüpfung aufgehoben',
  'Settings.integrations.emptyState.heading': 'Keine Integrationen verbunden',
  'Settings.integrations.emptyState.body':
    'Verbinden Sie externe Dienste, um Ihren Workflow zu erweitern.',
  'Settings.integrations.disconnectConfirmGeneric.title': 'Integration trennen?',
  'Settings.integrations.disconnectConfirmGeneric.body':
    'Dadurch wird die Verbindung entfernt. Sie können sie jederzeit wiederherstellen.',
  'Settings.integrations.provider.connectedOn': 'Verbunden am {date}',
  'Settings.integrations.provider.connectedTo': 'Verbunden mit {name}',
  'Settings.integrations.provider.connectionDetails': 'Verbindungsdetails',
  'Settings.integrations.provider.errorConnectionFailed': 'Verbindung fehlgeschlagen',
  'Settings.integrations.provider.errorTokenExpired':
    'Token abgelaufen – erneute Verbindung erforderlich',
  'Settings.integrations.provider.lastRefresh': 'Zuletzt aktualisiert {date}',
  'Settings.integrations.provider.syncLogEmpty': 'Noch keine Synchronisierungsprotokolle',
  'Settings.integrations.provider.syncLogHeading': 'Synchronisierungsprotokoll',
  'Settings.integrations.provider.tokenExpires': 'Token läuft ab',
  'Settings.integrations.provider.webhookLogEmpty': 'Noch keine Webhook-Ereignisse',
  'Settings.integrations.provider.webhookLogEventType': 'Ereignistyp',
  'Settings.integrations.provider.webhookLogHeading': 'Webhook-Protokoll',
  'Settings.integrations.provider.webhookLogProcessingTime': 'Verarbeitungszeit',
  'Settings.integrations.provider.statusReauth': 'Erneute Autorisierung erforderlich',
  'Settings.integrations.provider.disconnectCta': '{provider} trennen',
  'Settings.integrations.provider.connectCta': '{provider} verbinden',
  'Settings.integrations.providerToasts.connected': '{provider} erfolgreich verbunden',
  'Settings.integrations.providerToasts.disconnected': '{provider} getrennt',
  'Settings.integrations.ksef.descriptionDisconnected':
    'Rechnungen automatisch aus dem polnischen nationalen E-Invoicing-System abrufen',
  'Settings.integrations.linear.descriptionDisconnected':
    'Verbinden Sie Ihren Linear-Workspace, um Workflow-Aufgaben bidirektional mit Linear-Issues zu synchronisieren.',
  'Settings.integrations.linear.connectCta': 'Linear verbinden',
  'Settings.integrations.linear.connectedTo': 'Verbunden mit',
  'Settings.integrations.linear.connectedBy': 'Verbunden von',
  'Settings.integrations.linear.connectedOn': 'Verbunden am',
  'Settings.integrations.linear.disconnectCta': 'Linear trennen',
  'Settings.integrations.linear.reconnectCta': 'Linear erneut verbinden',
  'Settings.integrations.linear.statusDisconnected': 'Nicht verbunden',
  'Settings.integrations.linear.statusError': 'Verbindungsfehler',
  'Settings.integrations.linear.statusReauth': 'Erneute Authentifizierung erforderlich',
  'Settings.integrations.linear.configureMapping': 'Statuszuordnung konfigurieren',
  'Settings.integrations.linear.pendingMappingWarning':
    'Linear verbunden – konfigurieren Sie die Statuszuordnung für mindestens ein Team, um die bidirektionale Synchronisierung zu aktivieren.',
  'Settings.integrations.linear.scopeExpansionWarning':
    'Erneute Authentifizierung erforderlich – neue Berechtigungen für Issue-Erstellung und Webhooks benötigt.',
  'Settings.integrations.linear.mapping.title': 'Statuszuordnung',
  'Settings.integrations.linear.mapping.description':
    'Ordnen Sie Workflow-Aufgabenstatus den Linear-Workflow-Status für {teamName} zu.',
  'Settings.integrations.linear.mapping.selectTeam': 'Team auswählen',
  'Settings.integrations.linear.mapping.workflowStatus': 'Workflow-Status',
  'Settings.integrations.linear.mapping.linearState': 'Linear-Status',
  'Settings.integrations.linear.mapping.unmappedTooltip':
    'Nicht zugeordnet – Statusänderungen für diesen Zustand werden ignoriert',
  'Settings.integrations.linear.mapping.noTeams': 'Keine Linear-Teams gefunden',
  'Settings.integrations.linear.mapping.noTeamsBody':
    'Verbinden Sie Ihren Linear-Workspace, um verfügbare Teams zu sehen. Stellen Sie sicher, dass der Workspace mindestens ein Team enthält.',
  'Settings.integrations.linear.mapping.save': 'Zuordnung speichern',
  'Settings.integrations.linear.mapping.discard': 'Änderungen verwerfen',
  'Settings.integrations.linear.templateSettings.enableToggle':
    'Linear-Issue-Erstellung aktivieren',
  'Settings.integrations.linear.templateSettings.teamLabel': 'Linear-Team',
  'Settings.integrations.linear.templateSettings.teamPlaceholder': 'Team auswählen',
  'Settings.integrations.linear.templateSettings.noConnection':
    'Verbinden Sie Linear unter Einstellungen > Integrationen, um diese Option zu aktivieren.',
  'Settings.integrations.linear.disconnectConfirm.title': 'Linear trennen?',
  'Settings.integrations.linear.disconnectConfirm.body':
    'Alle synchronisierten Issues behalten ihren aktuellen Status, die bidirektionale Synchronisierung wird jedoch beendet. Sie können die Verbindung jederzeit wiederherstellen.',
  'Settings.integrations.linear.disconnectConfirm.confirm': 'Linear trennen',
  'Settings.integrations.linear.disconnectConfirm.cancel': 'Verbunden bleiben',
  'Settings.integrations.linear.toasts.connected': 'Linear-Workspace erfolgreich verbunden',
  'Settings.integrations.linear.toasts.disconnected': 'Linear getrennt',
  'Settings.integrations.linear.toasts.mappingSaved': 'Statuszuordnung gespeichert',
  'Settings.integrations.linear.toasts.connectFailed':
    'Linear-Verbindung fehlgeschlagen. Prüfen Sie die Workspace-Berechtigungen und versuchen Sie es erneut.',
  'Settings.integrations.linear.toasts.tokenExpired':
    'Linear-Token abgelaufen. Stellen Sie die Verbindung wieder her, um die bidirektionale Synchronisierung fortzusetzen.',
  'Settings.integrations.googleWorkspace.descriptionDisconnected':
    'Importieren Sie Ihr Team-Verzeichnis aus Google Workspace mit Rollenzuordnung.',
  'Settings.integrations.googleWorkspace.descriptionConnected':
    'Google Workspace verbunden. Verzeichnis wird täglich um 2:00 Uhr synchronisiert.',
  'Settings.integrations.teams.descriptionDisconnected':
    'Erhalten Sie Benachrichtigungen und geben Sie Rechnungen direkt in Microsoft Teams frei.',
  'Settings.integrations.teams.descriptionConnected':
    'Microsoft Teams verbunden. Benachrichtigungen werden an konfigurierte Kanäle gesendet.',
  'Settings.integrations.teams.channelMappingHeading': 'Kanalzuordnung',
  'Settings.integrations.teams.channelMappingDescription':
    'Legen Sie fest, welcher Kanal welche Benachrichtigungsart empfängt.',
  'Settings.integrations.teams.saveMapping': 'Zuordnung speichern',
  'Settings.integrations.teams.refreshChannels': 'Kanalliste aktualisieren',
  'Settings.integrations.teams.selectChannel': 'Kanal auswählen',
  'Settings.integrations.teams.noChannels':
    'Keine Kanäle verfügbar. Stellen Sie sicher, dass der Bot mindestens einem Team hinzugefügt wurde.',
  'Settings.integrations.teams.channelFetchError':
    'Teams-Kanäle konnten nicht geladen werden. Prüfen Sie, ob der Bot in Ihrem Teams-Workspace installiert ist, und versuchen Sie es erneut.',
  'Settings.integrations.teams.disconnectTitle': 'Microsoft Teams trennen',
  'Settings.integrations.teams.disconnectMessage':
    'Dadurch werden alle Teams-Benachrichtigungen gestoppt und gespeicherte Zugangsdaten entfernt. Bestehende Freigabeentscheidungen sind nicht betroffen. Fortfahren?',
  'Settings.integrations.teams.mappingSaved': 'Kanalzuordnung gespeichert.',
  'Settings.integrations.teams.disconnectSuccess': 'Microsoft Teams getrennt.',

  // ─── Settings.provider (top-level) ────────────────────────────────────────
  'Settings.provider.connectCta': '{provider} verbinden',
  'Settings.provider.disconnectCta': '{provider} trennen',
  'Settings.provider.reconnectCta': 'Zugriff erneut autorisieren',
  'Settings.provider.manageCta': 'Verbindung verwalten',
  'Settings.provider.connectedTo': 'Verbunden mit',
  'Settings.provider.connectedBy': 'Verbunden von',
  'Settings.provider.connectedOn': 'Verbunden am',
  'Settings.provider.tokenExpires': 'Token läuft ab',
  'Settings.provider.lastRefresh': 'Letzte Aktualisierung',
  'Settings.provider.statusDisconnected': 'Nicht verbunden',
  'Settings.provider.statusReauth': 'Erneute Authentifizierung erforderlich',
  'Settings.provider.errorConnectionFailed':
    'Verbindung fehlgeschlagen. Prüfen Sie Ihre Zugangsdaten und versuchen Sie es erneut.',
  'Settings.provider.errorTokenExpired':
    'Autorisierung abgelaufen. Autorisieren Sie erneut, um die Verbindung wiederherzustellen.',
  'Settings.provider.syncLogHeading': 'Synchronisierungsprotokoll',
  'Settings.provider.syncLogEmpty':
    'Noch keine Synchronisierungsaktivität. Aktivitäten erscheinen hier, sobald die Verbindung mit der Synchronisierung beginnt.',
  'Settings.provider.webhookLogHeading': 'Webhook-Zustellungen',
  'Settings.provider.webhookLogEmpty':
    'Noch keine Webhook-Zustellungen. Zustellungen erscheinen hier, sobald der Anbieter Ereignisse sendet.',
  'Settings.provider.webhookLogEventType': 'Ereignistyp',
  'Settings.provider.webhookLogProcessingTime': 'Verarbeitungszeit',
  'Settings.provider.connectionDetails': 'Verbindungsdetails',
  'Settings.disconnectConfirmGeneric.title': '{provider} trennen?',
  'Settings.disconnectConfirmGeneric.body':
    'Dies widerruft gespeicherte Zugangsdaten und beendet die Synchronisierung. Bestehende Daten werden nicht gelöscht. Sie können die Verbindung jederzeit wiederherstellen.',
  'Settings.disconnectConfirmGeneric.confirm': '{provider} trennen',
  'Settings.disconnectConfirmGeneric.cancel': 'Verbindung beibehalten',
  'Settings.providerToasts.connected': '{provider} erfolgreich verbunden',
  'Settings.providerToasts.disconnected': '{provider} getrennt',
  'Settings.emptyState.heading': 'Keine Integrationen verbunden',
  'Settings.emptyState.body':
    'Verbinden Sie unten einen Dienst, um automatische Synchronisierung, Webhook-Verarbeitung und Health-Monitoring zu aktivieren.',

  // ─── Settings.auditLog ────────────────────────────────────────────────────
  'Settings.auditLog.noChanges': 'Keine Feldänderungen erfasst',
  'Settings.auditLog.searchPlaceholder': 'Audit-Protokoll durchsuchen ...',
  'Settings.auditLog.exportCta': 'Audit-Protokoll exportieren',
  'Settings.auditLog.exportToast': 'Audit-Protokoll exportiert ({count} Einträge)',
  'Settings.auditLog.filterActorAll': 'Alle Akteure',
  'Settings.auditLog.filterActionAll': 'Alle Aktionen',
  'Settings.auditLog.filterResourceAll': 'Alle Ressourcen',
  'Settings.auditLog.empty.heading': 'Keine Audit-Protokolleinträge',
  'Settings.auditLog.empty.body':
    'Audit-Ereignisse erscheinen hier, sobald Aktionen im System ausgeführt werden.',

  // ─── Settings.branding ────────────────────────────────────────────────────
  'Settings.branding.heading': 'Portal-Branding',
  'Settings.branding.description':
    'Passen Sie das Erscheinungsbild des Auftragnehmer-Portals für Ihre Organisation an',
  'Settings.branding.logoHint': 'PNG, JPG oder SVG. Maximal 2 MB.',
  'Settings.branding.logoAlt': 'Organisationslogo',
  'Settings.branding.accentColor': 'Akzentfarbe',
  'Settings.branding.saveBranding': 'Branding speichern',
  'Settings.branding.successToast': 'Portal-Branding aktualisiert',
  'Settings.branding.invalidFileType': 'Bitte laden Sie eine PNG-, JPG- oder SVG-Datei hoch.',
  'Settings.branding.fileTooLarge': 'Logo darf höchstens 2 MB groß sein.',
  'Settings.branding.subdomainHeading': 'Portal-Subdomain',
  'Settings.branding.subdomainDescription': 'Auftragnehmer rufen das Portal auf unter',
  'Settings.branding.subdomainPlaceholder': 'z. B. acme',
  'Settings.branding.saveDomain': 'Domain speichern',
  'Settings.branding.subdomainUpdated': 'Portal-Subdomain aktualisiert',
  'Settings.branding.subdomainTaken': 'Diese Subdomain ist bereits vergeben',
  'Settings.branding.subdomainMinLength': 'Subdomain muss mindestens 3 Zeichen lang sein',
  'Settings.branding.subdomainMaxLength': 'Subdomain darf höchstens 63 Zeichen lang sein',
  'Settings.branding.subdomainFormat':
    'Nur Kleinbuchstaben, Zahlen und Bindestriche zulässig. Muss mit einem Buchstaben oder einer Zahl beginnen und enden.',
  'Settings.branding.previewButton': 'Beispielschaltfläche',
  'Settings.branding.previewLink': 'Beispiellink',

  // ─── Settings.changeRequest ────────────────────────────────────────────────
  'Settings.changeRequest.title': 'Anfrage zur Profiländerung',
  'Settings.changeRequest.table.currentValue': 'Aktueller Wert',
  'Settings.changeRequest.table.requestedValue': 'Angeforderter Wert',
  'Settings.changeRequest.approveChanges': 'Änderungen freigeben',
  'Settings.changeRequest.rejectChanges': 'Änderungen ablehnen',
  'Settings.changeRequest.rejectTitle': 'Änderungsanfrage ablehnen',
  'Settings.changeRequest.rejectDescription':
    'Geben Sie optional einen Grund für die Ablehnung an. Der Auftragnehmer wird benachrichtigt.',
  'Settings.changeRequest.rejectPlaceholder': 'Begründung der Ablehnung (optional)',
  'Settings.changeRequest.confirmRejection': 'Ablehnung bestätigen',
  'Settings.changeRequest.toast.approved':
    'Änderungsanfrage freigegeben. Auftragnehmerprofil aktualisiert.',
  'Settings.changeRequest.toast.rejected':
    'Änderungsanfrage abgelehnt. Auftragnehmer wurde benachrichtigt.',

  // ─── Settings.carriers / returnCarrier ────────────────────────────────────
  'Settings.carriers.notConfigured': 'Nicht konfiguriert',
  'Settings.carriers.testConnection': 'Verbindung testen',
  'Settings.carriers.saveCredentials': 'Zugangsdaten speichern',
  'Settings.carriers.connectionVerified': 'Verbindung verifiziert',
  'Settings.carriers.connectionFailed':
    'Verbindung fehlgeschlagen – prüfen Sie Ihre Zugangsdaten und versuchen Sie es erneut',
  'Settings.carriers.credentialsSaved': 'Zugangsdaten erfolgreich gespeichert',
  'Settings.carriers.fid': 'FID-Kontonummer',
  'Settings.carriers.clientId': 'Client-ID',
  'Settings.carriers.clientSecret': 'Client-Secret',
  'Settings.carriers.accountNumber': 'Kontonummer',
  'Settings.carriers.sandbox': 'Sandbox-Modus',
  'Settings.returnCarrier.label': 'Standard-Rückversanddienst',
  'Settings.returnCarrier.helper': 'Wird für alle Rücksendungen von Auftragnehmern verwendet.',
  'Settings.returnCarrier.saved': 'Standard-Rückversanddienst aktualisiert',
};
