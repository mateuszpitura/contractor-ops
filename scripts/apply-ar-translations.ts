#!/usr/bin/env tsx
/**
 * One-shot Arabic translation backfill.
 *
 * Reads apps/web/messages/ar.json, sets each dotted-path key to its
 * authored Arabic translation, and writes back with 2-space indent.
 *
 * Authored against en.json snapshot 2026-05-06; missing-key set from
 * .planning/translations/apps_web-ar-missing.json.
 *
 * Style: formal MSA, GCC business register. ICU placeholders preserved
 * verbatim. Acronyms (BACS, SEPA, KSeF, Peppol, DRV, IR35, HMRC, ZATCA,
 * Skonto, Steuerberater) kept in Latin script. Latin digits per
 * numberingSystem: 'latn' in the i18n config.
 *
 * Usage:
 *   pnpm tsx scripts/apply-ar-translations.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const AR_PATH = resolve(process.cwd(), 'apps/web/messages/ar.json');

// All 295 keys in dotted-path → Arabic value form.
// Each translation hand-authored. Comments mark sections.
const TRANSLATIONS: Record<string, string> = {
  // ── Settings.WorkflowRoles ───────────────────────────────────────────
  'Settings.WorkflowRoles.heading': 'أدوار سير العمل',
  'Settings.WorkflowRoles.subtitle': 'إدارة قوالب مهام نقل المعرفة لكل دور مقاول.',
  'Settings.WorkflowRoles.addCta': 'إضافة قالب دور',
  'Settings.WorkflowRoles.emptyHeading': 'لا توجد قوالب أدوار مخصصة',
  'Settings.WorkflowRoles.emptyBody':
    'القوالب الأربعة المدمجة (مهندس برمجيات، مصمم، مدير منتج، مستشار عام) متاحة دائمًا. أضف قالبًا مخصصًا لتوسيع تصنيف الأدوار لفريقك.',
  'Settings.WorkflowRoles.copyFromEnglish': 'نسخ من الإنجليزية',
  'Settings.WorkflowRoles.taskTitleLabel': 'عنوان المهمة',
  'Settings.WorkflowRoles.taskDescriptionLabel': 'الوصف',
  'Settings.WorkflowRoles.dueDayLabel': 'الاستحقاق بعد N يومًا من البدء',
  'Settings.WorkflowRoles.saveCta': 'حفظ القالب',
  'Settings.WorkflowRoles.savingCta': 'جارٍ الحفظ…',

  // ── Settings.PtoKeywords ─────────────────────────────────────────────
  'Settings.PtoKeywords.heading': 'الكلمات المفتاحية لإجازات التقويم',
  'Settings.PtoKeywords.subtitle':
    'أضف كلمات مفتاحية خاصة بكل لغة. تُعامَل أحداث التقويم التي تتطابق عناوينها مع هذه الكلمات باعتبارها إجازة مدفوعة.',
  'Settings.PtoKeywords.empty': 'لا توجد كلمات مفتاحية إضافية. الكلمات المدمجة لا تزال فعّالة.',
  'Settings.PtoKeywords.addCta': 'إضافة كلمة مفتاحية',

  // ── Payments.bacs ────────────────────────────────────────────────────
  'Payments.bacs.settingsPageTitle': 'إعدادات تصدير المدفوعات',
  'Payments.bacs.settingsPageSubtitle':
    'تكوين بيانات المُرسِل لتصدير دفعات BACS في المملكة المتحدة و SEPA في الاتحاد الأوروبي',
  'Payments.bacs.sectionHeading': 'مُرسِل BACS Standard 18 (المملكة المتحدة)',
  'Payments.bacs.sunLabel': 'رقم مستخدم الخدمة (SUN)',
  'Payments.bacs.sunHelper': 'رقم مستخدم خدمة BACS المكوّن من 6 أرقام والصادر عن البنك الراعي',
  'Payments.bacs.sortCodeLabel': 'رمز الفرز للحساب المُصدِر',
  'Payments.bacs.accountNumberLabel': 'رقم الحساب المُصدِر',
  'Payments.bacs.submitterNameLabel': 'اسم المُرسِل (بحد أقصى 18 حرفًا ASCII)',
  'Payments.bacs.saveSubmitter': 'حفظ بيانات المُرسِل',
  'Payments.bacs.savedToast': 'تم حفظ بيانات مُرسِل BACS',
  'Payments.bacs.featureFlagOffBanner':
    'تصدير BACS معطّل. فعّله في إعدادات الميزات لاستخدام BACS Std 18.',
  'Payments.bacs.previewCardTitle': 'معاينة BACS Std 18',
  'Payments.bacs.previewAction': 'معاينة ملف BACS',
  'Payments.bacs.downloadAction': 'تنزيل ملف BACS',
  'Payments.bacs.transliterationWarning':
    'تم تحويل {count} حرفًا إلى مجموعة أحرف BACS. راجع المعاينة قبل التنزيل.',
  'Payments.bacs.unmappableError':
    'تعذّر تحويل {count} حرفًا — سيرفض BACS هذا الملف. عدّل اسم/أسماء المقاولين وحاول مجددًا.',
  'Payments.bacs.modulusWarningTitle': 'فحوصات رمز الفرز',
  'Payments.bacs.emptyState':
    'لا توجد عناصر مؤهلة لـ BACS في هذه الدفعة. أضف مقاولين من المملكة المتحدة بفواتير بالجنيه الإسترليني لتوليد ملف BACS.',
  'Payments.bacs.submitterNotConfigured':
    'بيانات مُرسِل BACS مطلوبة. كوّنها في الإعدادات ← المدفوعات.',
  'Payments.bacs.generateFailure':
    'فشل توليد ملف BACS. حاول مجددًا أو تواصل مع الدعم إذا استمرت المشكلة.',

  // ── Payments.ukBank ──────────────────────────────────────────────────
  'Payments.ukBank.sortCodeLabel': 'رمز الفرز البريطاني',
  'Payments.ukBank.sortCodeHelper': '6 أرقام، تُضاف الشرطات تلقائيًا',
  'Payments.ukBank.accountNumberLabel': 'رقم الحساب البريطاني',
  'Payments.ukBank.accountNumberHelper': '8 أرقام',
  'Payments.ukBank.validateButton': 'التحقق من رمز الفرز',
  'Payments.ukBank.validationSuccess': 'اجتاز رمز الفرز فحص المُعامل (modulus)',
  'Payments.ukBank.validationWarn':
    'رمز الفرز ضمن نطاق استثنائي — فحص المُعامل غير حاسم. تابع إذا أكد البنك صحة هذا الحساب.',
  'Payments.ukBank.validationFail': 'صيغة رمز الفرز غير صالحة — مطلوب 6 أرقام',

  // ── Payments.lateInterest ────────────────────────────────────────────
  'Payments.lateInterest.sectionHeading': 'الفائدة القانونية على التأخر في السداد',
  'Payments.lateInterest.explanationTooltip':
    'تُحتسب بموجب Late Payment of Commercial Debts (Interest) Act 1998. المعدّل = معدّل بنك إنجلترا الأساسي + 8%، يُثبَّت في آخر يوم من فترة الستة أشهر القانونية السابقة (30 يونيو أو 31 ديسمبر).',
  'Payments.lateInterest.b2cBanner': 'الفائدة القانونية غير مطبّقة (معاملة B2C).',
  'Payments.lateInterest.principalOutstanding': 'أصل المبلغ المستحق',
  'Payments.lateInterest.daysOverdue': 'أيام التأخر',
  'Payments.lateInterest.rateUsed': 'المعدّل المستخدم',
  'Payments.lateInterest.dailyAccrual': 'الاستحقاق اليومي',
  'Payments.lateInterest.interestAccrued': 'الفائدة المستحقة',
  'Payments.lateInterest.fixedCompensation': 'التعويض الثابت',
  'Payments.lateInterest.totalStatutoryClaim': 'إجمالي المطالبة القانونية',
  'Payments.lateInterest.claimCta': 'المطالبة بالفائدة القانونية',
  'Payments.lateInterest.claimSecondaryOption': 'إصدار المطالبة كفاتورة ثانوية',
  'Payments.lateInterest.claimDialogTitle': 'المطالبة بالفائدة القانونية؟',
  'Payments.lateInterest.claimDialogBody':
    'سيؤدي هذا إلى تثبيت المبالغ الحالية للفائدة والتعويض، وتوليد ملف PDF لخطاب المطالبة، وإصدار فاتورة ثانوية بمبلغ المطالبة (اختياريًا). اللقطة غير قابلة للتعديل — لن يُضاف إليها أي استحقاق لاحق.',
  'Payments.lateInterest.downloadClaimPdf': 'تنزيل خطاب المطالبة',
  'Payments.lateInterest.claimedBanner':
    'تم تثبيت لقطة المطالبة في {date} — £{amount}. لا تُحتسب فائدة إضافية على هذه المطالبة.',
  'Payments.lateInterest.waiveCta': 'التنازل عن الفائدة',
  'Payments.lateInterest.waiveDialogTitle': 'التنازل عن الفائدة القانونية؟',
  'Payments.lateInterest.waiveReasonPlaceholder':
    'السبب (مطلوب، 10 أحرف على الأقل) — مثلاً: تسوية متفاوض عليها مع العميل، بادرة حسن نيّة، خطأ إداري',
  'Payments.lateInterest.waiveTypeInterestOnly': 'الفائدة فقط',
  'Payments.lateInterest.waiveTypeCompensationOnly': 'التعويض فقط',
  'Payments.lateInterest.waiveTypeBoth': 'كلاهما',
  'Payments.lateInterest.waiveConfirm': 'التنازل عن الفائدة',
  'Payments.lateInterest.waivedBanner':
    'تم التنازل عن الفائدة في {date} بواسطة {name}. {revokeLink}',
  'Payments.lateInterest.revokeWaiverCta': 'إلغاء التنازل',
  'Payments.lateInterest.revokeReasonPlaceholder': 'سبب الإلغاء (مطلوب) — مثلاً: رفض العميل التسوية',

  // ── Payments.overdueInterest ─────────────────────────────────────────
  'Payments.overdueInterest.columnHeader': 'فائدة التأخر',
  'Payments.overdueInterest.filterChip': 'متأخر',
  'Payments.overdueInterest.emptyState': 'لا توجد فواتير B2B بريطانية متأخرة',

  // ── Payments.dashboardTile ───────────────────────────────────────────
  'Payments.dashboardTile.title': 'الذمم المتأخرة (المملكة المتحدة)',
  'Payments.dashboardTile.subline': '{principal} مستحق — +{interest} فائدة مستحقة',
  'Payments.dashboardTile.clickThrough': 'عرض الفواتير المتأخرة ←',

  // ── Payments.skonto (German early-payment discount) ──────────────────
  'Payments.skonto.sectionHeading': 'خصم السداد المبكر (Skonto)',
  'Payments.skonto.useDefaultPill':
    'يستخدم الإعداد الافتراضي للمقاول: {percent}% / {discountDays} يومًا / صافي {netDays} يومًا',
  'Payments.skonto.customizeToggle': 'تخصيص لهذه الفاتورة',
  'Payments.skonto.discountPercentLabel': 'نسبة الخصم %',
  'Payments.skonto.discountPeriodLabel': 'فترة الخصم (أيام)',
  'Payments.skonto.netPeriodLabel': 'الفترة الصافية (أيام)',
  'Payments.skonto.previewLineEn':
    'خصم {percent}% عند السداد خلال {discountDays} يومًا، وإلا صافي {netDays} يومًا',
  'Payments.skonto.saveTerm': 'حفظ شروط Skonto',
  'Payments.skonto.deleteInvoiceSpecific': 'إعادة التعيين إلى افتراضي المقاول',
  'Payments.skonto.validationPercentRange': 'يجب أن يكون الخصم بين 0 و 50%',
  'Payments.skonto.validationDaysOrdering': 'يجب أن تكون فترة الخصم أقصر من الفترة الصافية',
  'Payments.skonto.eligibleBanner':
    'وفّر {discountAmount} عند السداد بحلول {date} — الإجمالي بعد الخصم {discountedTotal}',
  'Payments.skonto.windowExpiredBanner': 'انتهت نافذة الخصم في {date}',
  'Payments.skonto.takenBanner':
    'تم تطبيق Skonto عند السداد: تم توفير {discountAmount} في {paidDate}',
  'Payments.skonto.notTakenBanner': 'تم السداد بعد نافذة الخصم — لم يُطبَّق Skonto',
  'Payments.skonto.defaultSectionHeading': 'خصم السداد المبكر الافتراضي',
  'Payments.skonto.defaultHelper':
    'يُطبَّق تلقائيًا على فواتير DE الجديدة لهذا المقاول. ويمكن تجاوزه لكل فاتورة على حدة.',
  'Payments.skonto.saveDefault': 'حفظ Skonto الافتراضي',
  'Payments.skonto.clearDefault': 'إزالة Skonto الافتراضي',
  'Payments.skonto.lineCheckboxLabel': 'تطبيق Skonto بنسبة {percent}% — توفير {discountAmount}',
  'Payments.skonto.outsideWindowHelper': 'انتهت نافذة الخصم ({date}) — يُطبَّق المبلغ الكامل',
  'Payments.skonto.snapshotToast':
    'تم تطبيق Skonto على الدفعة — {count} فاتورة مخصومة، تم توفير {totalSavings}',
  'Payments.skonto.columnHeader': 'Skonto',
  'Payments.skonto.emptyCell': '—',
  'Payments.skonto.cellFormat': '{percent}% {discountDays}/{netDays}',

  // ── Legal.terms.sections.softwareNotLegalAdvice ──────────────────────
  'Legal.terms.sections.softwareNotLegalAdvice.heading': 'البرنامج — ليس استشارة قانونية أو مهنية',
  'Legal.terms.sections.softwareNotLegalAdvice.subheading': 'قيود مهمة على طبيعة مخرجات هذه المنصة',

  // ── Legal.SdsApproval ────────────────────────────────────────────────
  'Legal.SdsApproval.gateTitle': 'موافقة العميل مطلوبة قبل توليد SDS',
  'Legal.SdsApproval.clientNameLabel': 'اسم العميل',
  'Legal.SdsApproval.clientNamePlaceholder': 'أدخل اسم الشركة المتعاقِدة النهائية',
  'Legal.SdsApproval.confirmApproval': 'تأكيد الموافقة والمتابعة',
  'Legal.SdsApproval.confirmingApproval': 'جارٍ التأكيد...',
  'Legal.SdsApproval.approved': 'تمت الموافقة — يمكنك الآن توليد SDS',

  // ── Legal.DrvUpload ──────────────────────────────────────────────────
  'Legal.DrvUpload.uploadDecisionLetter': 'رفع خطاب قرار DRV',
  'Legal.DrvUpload.uploading': 'جارٍ الرفع...',
  'Legal.DrvUpload.uploadedAt': 'تم الرفع في {date} بواسطة {user}',
  'Legal.DrvUpload.downloadLetter': 'تنزيل خطاب القرار',
  'Legal.DrvUpload.fileTooLarge': 'الملف كبير جدًا (بحد أقصى 10 ميغابايت)',

  // ── Legal.TermsModal ─────────────────────────────────────────────────
  'Legal.TermsModal.title': 'شروط الخدمة المُحدّثة',
  'Legal.TermsModal.description':
    'تم تحديث شروط الخدمة لدينا (الإصدار {version}). يُرجى مراجعتها وقبولها لمتابعة استخدام المنصة.',
  'Legal.TermsModal.readFull': 'اقرأ النص الكامل لـ',
  'Legal.TermsModal.termsLink': 'شروط الخدمة',
  'Legal.TermsModal.accept': 'أوافق على شروط الخدمة',
  'Legal.TermsModal.accepting': 'جارٍ تسجيل القبول...',

  // ── Ir35Chain ────────────────────────────────────────────────────────
  'Ir35Chain.title': 'سلسلة IR35',
  'Ir35Chain.subtitle':
    'تتبّع سلسلة العميل ← الوكالة ← PSC ← العامل، وحالة تسليم/استلام SDS لكل حلقة.',
  'Ir35Chain.emptyState': 'لا يوجد مشاركون في السلسلة بعد.',
  'Ir35Chain.addParticipant': 'إضافة مشارك',
  'Ir35Chain.addParticipantTitle': 'إضافة مشارك في السلسلة',
  'Ir35Chain.addParticipantHint': 'أضف وكالة أو شركة خدمة شخصية إلى سلسلة هذا التعاقد.',
  'Ir35Chain.displayName': 'الاسم المعروض',
  'Ir35Chain.roleLabel': 'الدور',
  'Ir35Chain.contactEmail': 'البريد الإلكتروني لجهة الاتصال',
  'Ir35Chain.cancel': 'إلغاء',
  'Ir35Chain.save': 'حفظ',
  'Ir35Chain.saving': 'جارٍ الحفظ…',
  'Ir35Chain.confirm': 'تأكيد',
  'Ir35Chain.noteLabel': 'ملاحظة (اختياري)',
  'Ir35Chain.markDelivered': 'تحديد كمُسلَّم',
  'Ir35Chain.markAcknowledged': 'تحديد كمُستلَم',
  'Ir35Chain.markDeliveredTitle': 'تحديد SDS كمُسلَّم',
  'Ir35Chain.markAcknowledgedTitle': 'تحديد SDS كمُستلَم',
  'Ir35Chain.remove': 'إزالة',
  'Ir35Chain.notDelivered': 'لم يُسلَّم',
  'Ir35Chain.notAcknowledged': 'لم يُستلَم',
  'Ir35Chain.columnRole': 'الدور',
  'Ir35Chain.columnDisplayName': 'الاسم',
  'Ir35Chain.columnDelivered': 'تم التسليم',
  'Ir35Chain.columnAcknowledged': 'تم الاستلام',
  'Ir35Chain.columnActions': 'الإجراءات',
  'Ir35Chain.role.CLIENT': 'العميل',
  'Ir35Chain.role.AGENCY': 'الوكالة',
  'Ir35Chain.role.PSC': 'PSC',
  'Ir35Chain.role.WORKER': 'العامل',

  // ── OtherClientAttestation ───────────────────────────────────────────
  'OtherClientAttestation.title': 'إقرار بوجود عملاء آخرين',
  'OtherClientAttestation.subtitle':
    'أكّد ما إذا كان هذا المقاول مرتبطًا بعملاء آخرين — يُستخدم لدعم حزمة دفاع تدقيق DRV.',
  'OtherClientAttestation.statementLabel': 'الإقرار',
  'OtherClientAttestation.statementHint': 'صِف عملاءك النشطين الآخرين. بحد أقصى {max} حرفًا.',
  'OtherClientAttestation.signedNameLabel': 'الاسم الموقِّع',
  'OtherClientAttestation.submit': 'إرسال الإقرار',
  'OtherClientAttestation.update': 'تحديث الإقرار',
  'OtherClientAttestation.saving': 'جارٍ الحفظ…',

  // ── Classification.documents ─────────────────────────────────────────
  'Classification.documents.title': 'مستندات التصنيف',
  'Classification.documents.subtitle':
    'توليد بيان تحديد الحالة المطلوب قانونيًا وحزمة الدفاع للتدقيق.',
  'Classification.documents.generateSds': 'توليد SDS',
  'Classification.documents.generateDisabled': 'أكمل تقييم تصنيف IR35 لتوليد SDS.',
  'Classification.documents.generateDrvBundle': 'توليد حزمة دفاع DRV',
  'Classification.documents.drvDisabledNeedAssessment':
    'أكمل تقييم تصنيف Scheinselbständigkeit لتوليد حزمة دفاع DRV.',
  'Classification.documents.drvDisabledNeedAttestation':
    'سجّل إقرار العملاء الآخرين أدناه قبل توليد حزمة دفاع DRV.',
  'Classification.documents.generating': 'جارٍ التوليد…',
  'Classification.documents.documentHistory': 'سجل المستندات',
  'Classification.documents.emptyState': 'لم يتم توليد أي مستندات بعد.',
  'Classification.documents.download': 'تنزيل',
  'Classification.documents.generatedOn': 'تم التوليد في {date}',
  'Classification.documents.byteSize': '{kb} كيلوبايت',
  'Classification.documents.toastSdsGenerated': 'تم توليد SDS — يجري فتح التنزيل…',
  'Classification.documents.errorGenericTitle': 'تعذّر توليد المستند',
  'Classification.documents.kindSds': 'بيان تحديد الحالة (Status Determination Statement)',
  'Classification.documents.kindDrvDefenseBundle': 'حزمة دفاع تدقيق DRV',

  // ── Classification.AdvisoryBanner ────────────────────────────────────
  'Classification.AdvisoryBanner.label': 'إشعار قانوني',

  // ── Classification.ExpertHelp ────────────────────────────────────────
  'Classification.ExpertHelp.title': 'احصل على مساعدة متخصصة',
  'Classification.ExpertHelp.subtitle': 'تواصل مع مستشارين مؤهلين للإجابة عن استفسارات التصنيف.',
  'Classification.ExpertHelp.orgAdviser.title': 'مستشار مؤسستك',
  'Classification.ExpertHelp.orgAdviser.description':
    'عيّنت مؤسستك مستشارًا للإجابة عن استفسارات التصنيف.',
  'Classification.ExpertHelp.orgAdviser.contact': 'التواصل مع المستشار',
  'Classification.ExpertHelp.gb.title': 'مستشارو IR35 في المملكة المتحدة',
  'Classification.ExpertHelp.gb.description':
    'تواصل مع مستشاري ضرائب معتمدين من CIOT أو ATT متخصصين في IR35.',
  'Classification.ExpertHelp.gb.ciot.title': 'CIOT — البحث عن مستشار ضرائب',
  'Classification.ExpertHelp.gb.ciot.description': 'دليل أعضاء Chartered Institute of Taxation',
  'Classification.ExpertHelp.gb.hmrc.title': 'دليل HMRC لحالة التوظيف',
  'Classification.ExpertHelp.gb.hmrc.description':
    'الإرشادات الرسمية من HMRC حول IR35 وحالة التوظيف',
  // German-specific keys: source text is mixed German + reference to Steuerberater.
  // Keep core German statutory terms; surround with Arabic context where useful.
  'Classification.ExpertHelp.de.title': 'Steuerberater للتعامل مع Scheinselbständigkeit',
  'Classification.ExpertHelp.de.description':
    'استشارات متخصصة حول Scheinselbständigkeit وإجراءات تحديد الحالة لدى DRV.',
  'Classification.ExpertHelp.de.steuerberater.title': 'Steuerberaterkammer — البحث عن عضو',
  'Classification.ExpertHelp.de.steuerberater.description':
    'غرف Steuerberater الإقليمية التابعة لـ Bundessteuerberaterkammer',
  'Classification.ExpertHelp.de.drv.title':
    'إجراء تحديد الحالة لدى DRV (Statusfeststellungsverfahren)',
  'Classification.ExpertHelp.de.drv.description':
    'المعلومات الرسمية من DRV حول إجراء تحديد الحالة وفق § 7a SGB IV',

  // ── Admin.BoeRate ────────────────────────────────────────────────────
  'Admin.BoeRate.pageTitle': 'سجل المعدّل الأساسي لبنك إنجلترا',
  'Admin.BoeRate.pageSubtitle':
    'بيانات مرجعية تدعم حسابات الفائدة القانونية على التأخر في السداد في المملكة المتحدة',
  'Admin.BoeRate.colEffectiveFrom': 'سارٍ من',
  'Admin.BoeRate.colRatePercent': 'المعدّل %',
  'Admin.BoeRate.colSource': 'المصدر',
  'Admin.BoeRate.colRecordedBy': 'سُجِّل بواسطة',
  'Admin.BoeRate.colRecordedAt': 'تاريخ التسجيل',
  'Admin.BoeRate.colNotes': 'ملاحظات',
  'Admin.BoeRate.sourceBoeApi': 'BOE API',
  'Admin.BoeRate.sourceManual': 'يدوي',
  'Admin.BoeRate.addCta': '+ إضافة معدّل',
  'Admin.BoeRate.addDialogTitle': 'إضافة سجل معدّل أساسي لبنك إنجلترا',
  'Admin.BoeRate.deleteDialogTitle': 'حذف سجل معدّل BoE؟',
  'Admin.BoeRate.deleteDialogBody':
    'حذف معدّل تاريخي يُغيّر حسابات الفائدة لأي فواتير أصبحت متأخرة خلال فترة سريانه. تابع فقط إذا تم إدخال هذا السجل بالخطأ.',
  'Admin.BoeRate.pollerSuccess':
    'آخر استعلام لـ BoE API: {date} — المعدّل دون تغيير / تم تسجيل معدّل جديد {percent}%',
  'Admin.BoeRate.pollerFailure':
    'فشل آخر استعلام لـ BoE API في {date}. لا يزال الإدخال اليدوي ممكنًا؛ سيُعاد المحاولة في التشغيل المجدول التالي.',

  // ── Admin.ClassificationEngineFlag ───────────────────────────────────
  'Admin.ClassificationEngineFlag.title': 'حالة علم محرّك التصنيف',
  'Admin.ClassificationEngineFlag.subtitle':
    'حالة مفتاح إيقاف module.classification-engine وسجل توقيعات الإقرار.',
  'Admin.ClassificationEngineFlag.appSideValue': 'القيمة على جانب التطبيق (ما يراه المستخدمون)',
  'Admin.ClassificationEngineFlag.signoffRegistry': 'سجل التوقيعات',
  'Admin.ClassificationEngineFlag.pendingGate':
    'العَلم مُفعَّل في Unleash ولكنه مُقيَّد على مستوى التطبيق — {count} إقرار(ات) قيد الانتظار.',
  'Admin.ClassificationEngineFlag.pendingGateResolution':
    'حلّ المشكلة بإرسال PR يُحدّث packages/validators/src/legal/signoff-registry.json',

  // ── Offboarding.Templates.SoftwareEngineer ───────────────────────────
  'Offboarding.Templates.SoftwareEngineer.displayName': 'مهندس برمجيات',
  'Offboarding.Templates.SoftwareEngineer.handoverDocs.title': 'تسليم الوثائق التقنية',
  'Offboarding.Templates.SoftwareEngineer.handoverDocs.description':
    'سلِّم مخططات البنية، وأدلة التشغيل، وأي وثائق تقنية داخلية يمتلكها المقاول.',
  'Offboarding.Templates.SoftwareEngineer.codeWalkthrough.title': 'إرشاد الخلف عبر قاعدة الكود',
  'Offboarding.Templates.SoftwareEngineer.codeWalkthrough.description':
    'اعقد جلسة تعاون مع الخلف لجولة موجَّهة عبر الخدمات والمستودعات وسير عمل CI التي كان المقاول مسؤولًا عنها.',
  'Offboarding.Templates.SoftwareEngineer.openPRs.title': 'إغلاق أو تسليم طلبات السحب المفتوحة',
  'Offboarding.Templates.SoftwareEngineer.openPRs.description':
    'أغلِق أو ادمج أو انقل ملكية كل طلب سحب مفتوح أنشأه المقاول.',
  'Offboarding.Templates.SoftwareEngineer.deploymentRunbook.title': 'تحديث دليل تشغيل النشر',
  'Offboarding.Templates.SoftwareEngineer.deploymentRunbook.description':
    'وثِّق في دليل تشغيل النشر المعرفة الضمنية لدى المقاول — الخصوصيات ومسارات التصعيد وفحوصات ما بعد النشر.',
  'Offboarding.Templates.SoftwareEngineer.onCallRotation.title': 'إزالة من جدول المناوبات',
  'Offboarding.Templates.SoftwareEngineer.onCallRotation.description':
    'استبدل المقاول في جداول PagerDuty / Opsgenie وأبلِغ بقية المناوبين.',
  'Offboarding.Templates.SoftwareEngineer.architectureNotes.title': 'تسجيل قرارات البنية المعمارية',
  'Offboarding.Templates.SoftwareEngineer.architectureNotes.description':
    'وثِّق أي قرارات معمارية قيد التنفيذ كان المقاول يقودها.',
  'Offboarding.Templates.SoftwareEngineer.knownIssues.title':
    'توثيق المشكلات المعروفة والإصلاحات قيد العمل',
  'Offboarding.Templates.SoftwareEngineer.knownIssues.description':
    'اذكر المشكلات المعروفة في الإنتاج التي كان المقاول يتابعها وحالة أي إصلاحات جارية.',

  // ── Offboarding.Templates.Designer ───────────────────────────────────
  'Offboarding.Templates.Designer.displayName': 'مصمم',
  'Offboarding.Templates.Designer.designSystemHandover.title': 'تسليم ملكية نظام التصميم',
  'Offboarding.Templates.Designer.designSystemHandover.description':
    'انقل ملكية مكوّنات نظام التصميم والرموز (tokens) وأنماط المساهمة إلى الخلف.',
  'Offboarding.Templates.Designer.figmaTransfer.title': 'نقل ملكية مشاريع Figma',
  'Offboarding.Templates.Designer.figmaTransfer.description':
    'انقل ملفات Figma الخاصة بالمقاول إلى مكتبة الفريق وأعِد توزيع مقاعد المحرّرين.',
  'Offboarding.Templates.Designer.assetLibraryAccess.title': 'تحديث صلاحيات مكتبة الأصول',
  'Offboarding.Templates.Designer.assetLibraryAccess.description':
    'أزِل المقاول من مكتبات الأصول المشتركة وأعِد توزيع مهام الإشراف.',
  'Offboarding.Templates.Designer.activeProjects.title': 'تسليم مشاريع التصميم النشطة',
  'Offboarding.Templates.Designer.activeProjects.description':
    'أرشِد الخلف عبر كل مشروع تصميم قيد التنفيذ — النطاق والقيود والقرارات المفتوحة.',
  'Offboarding.Templates.Designer.brandGuidelinesUpdate.title':
    'تحديث صاحب إرشادات العلامة التجارية',
  'Offboarding.Templates.Designer.brandGuidelinesUpdate.description':
    'استبدل المقاول كجهة تأليف إرشادات العلامة التجارية وأعِد تشغيل سير عمل النشر.',
  'Offboarding.Templates.Designer.researchArchive.title': 'أرشفة مخرجات أبحاث تجربة المستخدم',
  'Offboarding.Templates.Designer.researchArchive.description':
    'انقل ملاحظات وأبحاث ومستندات تركيب المعلومات الخاصة بالمقاول إلى أرشيف الفريق.',

  // ── Offboarding.Templates.ProductManager ─────────────────────────────
  'Offboarding.Templates.ProductManager.displayName': 'مدير منتج',
  'Offboarding.Templates.ProductManager.roadmapTransfer.title': 'نقل ملكية خارطة الطريق',
  'Offboarding.Templates.ProductManager.roadmapTransfer.description':
    'سلِّم مستند خارطة الطريق وأي لوحات تخطيط إلى الخلف أو المالك المؤقت.',
  'Offboarding.Templates.ProductManager.stakeholderIntros.title': 'تعريف أصحاب المصلحة بالخلف',
  'Offboarding.Templates.ProductManager.stakeholderIntros.description':
    'حدّد مكالمات تعارف بين أصحاب المصلحة الرئيسيين والخلف أو المالك المؤقت.',
  'Offboarding.Templates.ProductManager.activeInitiatives.title': 'تسليم المبادرات النشطة',
  'Offboarding.Templates.ProductManager.activeInitiatives.description':
    'اطلع الخلف على كل مبادرة قيد التنفيذ — النطاق والعوائق والمراحل التالية.',
  'Offboarding.Templates.ProductManager.metricsContext.title': 'توثيق تعريفات المقاييس وسجلّها',
  'Offboarding.Templates.ProductManager.metricsContext.description':
    'وثِّق سبب تتبّع كل مقياس وأي تحفظات يحتاجها الخلف لتفسيره بشكل صحيح.',
  'Offboarding.Templates.ProductManager.researchInsights.title': 'أرشفة رؤى البحث',
  'Offboarding.Templates.ProductManager.researchInsights.description':
    'احفظ رؤى أبحاث المستخدمين، ومحاضر المقابلات، ومستندات تركيب المعلومات في مكتبة الفريق.',
  'Offboarding.Templates.ProductManager.vendorRelationships.title': 'إعادة توزيع علاقات المورّدين',
  'Offboarding.Templates.ProductManager.vendorRelationships.description':
    'أبلِغ المورّدين الخارجيين بتغيير جهة الاتصال وأعِد تعيين المالك من جانب الفريق لكل عقد.',

  // ── Offboarding.Templates.GenericConsultant ──────────────────────────
  'Offboarding.Templates.GenericConsultant.displayName': 'مستشار عام',
  'Offboarding.Templates.GenericConsultant.handoverDocs.title': 'تسليم وثائق التعاقد',
  'Offboarding.Templates.GenericConsultant.handoverDocs.description':
    'جمِّع حزمة تسليم واحدة تغطي النطاق والمخرجات والقرارات والمخاطر العالقة.',
  'Offboarding.Templates.GenericConsultant.activeProjectStatus.title': 'توثيق حالة المشاريع النشطة',
  'Offboarding.Templates.GenericConsultant.activeProjectStatus.description':
    'سجّل لقطة لحالة كل مشروع نشط — المُنجز والقيد التنفيذ والمعرَّض للخطر.',
  'Offboarding.Templates.GenericConsultant.clientStakeholderHandover.title':
    'تسليم علاقات العملاء وأصحاب المصلحة',
  'Offboarding.Templates.GenericConsultant.clientStakeholderHandover.description':
    'اطلع الخلف على كل عميل وأصحاب المصلحة الرئيسيين، بما في ذلك تفضيلات التواصل والسياق السياسي.',
  'Offboarding.Templates.GenericConsultant.deliverableArchive.title':
    'أرشفة المخرجات والملفات المصدر',
  'Offboarding.Templates.GenericConsultant.deliverableArchive.description':
    'ارفع المخرجات النهائية والملفات المصدر (عروض تقديمية، جداول، مسودات) إلى مستودع الفريق.',
  'Offboarding.Templates.GenericConsultant.knowledgeRepoIndex.title':
    'فهرسة المساهمات في قاعدة المعرفة',
  'Offboarding.Templates.GenericConsultant.knowledgeRepoIndex.description':
    'فهرِس مساهمات المقاول في قاعدة معرفة الفريق لتسهيل الوصول إليها.',
  'Offboarding.Templates.GenericConsultant.contactDirectory.title': 'تسليم دليل جهات الاتصال',
  'Offboarding.Templates.GenericConsultant.contactDirectory.description':
    'شارك قائمة جهات الاتصال المنسَّقة للمقاول (العملاء، المورّدون، المستشارون) مع الخلف.',

  // ── Offboarding.OverrideDialog ───────────────────────────────────────
  'Offboarding.OverrideDialog.title': 'تجاوز حظر التحقق من الملكية الفكرية',
  'Offboarding.OverrideDialog.description':
    'يمكن للمالكين إكمال عملية الإنهاء دون التحقق من الملكية الفكرية. التجاوز دائم ومُسجَّل في سجل التدقيق.',
  'Offboarding.OverrideDialog.reasonLabel': 'سبب التجاوز',
  'Offboarding.OverrideDialog.reasonPlaceholder':
    'صِف سبب تجاوز التحقق من الملكية الفكرية (20 حرفًا كحد أدنى).',
  'Offboarding.OverrideDialog.reasonClientError': 'قدّم ما لا يقل عن 20 حرفًا تشرح فيها التجاوز.',
  'Offboarding.OverrideDialog.reasonServerError':
    'يجب ألا يقل السبب عن 20 حرفًا وأن يتضمن شرحًا جوهريًا.',
  'Offboarding.OverrideDialog.acknowledgement':
    'أؤكّد أن التحقق من الملكية الفكرية يُتجاوَز عمدًا وأتحمّل مسؤولية أي فجوة امتثال.',
  'Offboarding.OverrideDialog.cta': 'تجاوز',
  'Offboarding.OverrideDialog.ctaLoading': 'جارٍ تسجيل التجاوز…',
  'Offboarding.OverrideDialog.cancel': 'إلغاء',
  'Offboarding.OverrideDialog.discardConfirm.title': 'تجاهل سبب التجاوز؟',
  'Offboarding.OverrideDialog.discardConfirm.body':
    'لقد كتبت سبب تجاوز. إغلاق النافذة الآن سيؤدي إلى تجاهله.',
  'Offboarding.OverrideDialog.discardConfirm.confirm': 'تجاهل',
  'Offboarding.OverrideDialog.discardConfirm.cancel': 'متابعة التحرير',

  // ── Offboarding.OverrideBadge ────────────────────────────────────────
  'Offboarding.OverrideBadge.label': 'تم تجاوز التحقق من الملكية الفكرية',
  'Offboarding.OverrideBadge.tooltipReason': 'السبب: {reason}',
  'Offboarding.OverrideBadge.tooltipActor': 'تم التجاوز بواسطة {name} في {date}',
  'Offboarding.OverrideBadge.tooltipBlockedTask': 'المهمة المحظورة: IP_VERIFICATION',

  // ── Offboarding.PtoBadge ─────────────────────────────────────────────
  'Offboarding.PtoBadge.label': 'لا يوجد معتمِد احتياطي — المدير في إجازة',
  'Offboarding.PtoBadge.tooltip':
    'قم بتكوين معتمِد احتياطي في الإعدادات ← الفرق لتفادي التوجيه إلى مالكي المؤسسة افتراضيًا.',

  // ── Offboarding.LocaleFallback ───────────────────────────────────────
  'Offboarding.LocaleFallback.suffix': ' (بالإنجليزية)',
  'Offboarding.LocaleFallback.srDescription':
    'لم تتم ترجمة حقل القالب هذا إلى {targetLocale}؛ يُعرض النص الإنجليزي كقيمة احتياطية.',

  // ── Workflow.Start ───────────────────────────────────────────────────
  'Workflow.Start.heading': 'بدء عملية إنهاء التعاقد مع {contractor}',
  'Workflow.Start.templateLabel': 'قالب نقل المعرفة',
  'Workflow.Start.autoSelectHint': 'تم التحديد تلقائيًا من دور المقاول: {roleName}',
  'Workflow.Start.manualOverrideHint': 'اختر قالبًا مختلفًا…',
  'Workflow.Start.cta': 'بدء عملية إنهاء التعاقد',
};

function setDeep(target: Record<string, unknown>, path: string, value: string): void {
  const parts = path.split('.');
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const seg = parts[i]!;
    const next = cursor[seg];
    if (next === undefined || next === null || typeof next !== 'object' || Array.isArray(next)) {
      const fresh: Record<string, unknown> = {};
      cursor[seg] = fresh;
      cursor = fresh;
    } else {
      cursor = next as Record<string, unknown>;
    }
  }
  cursor[parts[parts.length - 1]!] = value;
}

function main(): void {
  const raw = readFileSync(AR_PATH, 'utf-8');
  const ar = JSON.parse(raw) as Record<string, unknown>;

  let applied = 0;
  for (const [key, value] of Object.entries(TRANSLATIONS)) {
    setDeep(ar, key, value);
    applied += 1;
  }

  writeFileSync(AR_PATH, JSON.stringify(ar, null, 2) + '\n', 'utf-8');
  process.stdout.write(`applied ${applied} translation(s) to ${AR_PATH}\n`);
}

main();
