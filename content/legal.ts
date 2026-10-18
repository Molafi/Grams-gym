/**
 * DRAFT legal documents — must be reviewed by a qualified lawyer in Jordan
 * before going live (docs/OWNER-TODO.md). Payment providers review these pages.
 * Business identifiers in [brackets] are placeholders for the owner to fill.
 */
export type LegalDoc = "terms" | "privacy" | "refunds" | "shipping";
type Section = { h: string; p: string[] };

export const LEGAL_UPDATED = "2026-10-18";

export const legal: Record<LegalDoc, { ar: Section[]; en: Section[] }> = {
  terms: {
    en: [
      { h: "1. Who we are", p: ["GRAMS GYM (\"we\", \"us\") operates a fitness center in Amman, Jordan and this website. Legal entity: [registered company name], commercial registration no. [number], address: [address]. Contact: 079 555 6818."] },
      { h: "2. Accounts", p: ["You must provide accurate information and keep your sign-in credentials secure. You must be at least 16 years old to hold a membership; members under 18 need a guardian's consent.", "We may suspend accounts used for fraud, abuse or in breach of these terms."] },
      { h: "3. Memberships", p: ["Memberships give access to the gym during published opening hours, subject to the gym rules displayed at the facility.", "Online memberships renew automatically at the end of each billing period (monthly, quarterly or yearly) until cancelled. You can cancel at any time from your account; access continues until the end of the period already paid.", "Membership is personal and non-transferable. Staff may verify your membership card at the front desk.", "If a renewal payment fails, access may continue for a short grace period while the payment is retried, after which the membership is suspended."] },
      { h: "4. Health and safety", p: ["Physical training carries inherent risk. Consult a doctor before starting any training or supplement program. Follow staff instructions and use equipment properly. Tell a coach about any medical condition that may affect your training."] },
      { h: "5. Supplement store", p: ["Product descriptions are provided for information only and are not medical advice. Prices are in Jordanian dinar and may change; the price shown at checkout applies. Orders are subject to availability."] },
      { h: "6. Payments", p: ["Online card payments for memberships are processed by our payment provider acting as merchant of record; their terms also apply to the transaction. We do not store full card numbers."] },
      { h: "7. Liability", p: ["To the extent permitted by Jordanian law, we are not liable for indirect losses or for loss of personal belongings at the facility. Nothing in these terms limits liability that cannot be limited by law."] },
      { h: "8. Governing law", p: ["These terms are governed by the laws of the Hashemite Kingdom of Jordan. Disputes are subject to the courts of Amman."] },
    ],
    ar: [
      { h: "1. من نحن", p: ["تدير جرامز جيم (\"نحن\") مركزاً للياقة البدنية في عمّان، الأردن، وهذا الموقع الإلكتروني. الجهة القانونية: [اسم الشركة المسجل]، رقم السجل التجاري: [الرقم]، العنوان: [العنوان]. للتواصل: 079 555 6818."] },
      { h: "2. الحسابات", p: ["يجب تقديم معلومات صحيحة والحفاظ على سرية بيانات الدخول. يُشترط ألا يقل عمر المشترك عن 16 عاماً، ويحتاج من هم دون 18 عاماً إلى موافقة ولي الأمر.", "يحق لنا إيقاف الحسابات المستخدمة في الاحتيال أو الإساءة أو المخالفة لهذه الشروط."] },
      { h: "3. الاشتراكات", p: ["يتيح الاشتراك دخول النادي خلال ساعات العمل المعلنة، مع الالتزام بتعليمات النادي المعروضة في المرفق.", "تتجدد الاشتراكات الإلكترونية تلقائياً في نهاية كل فترة فوترة (شهرية أو ربع سنوية أو سنوية) إلى أن يتم إلغاؤها. يمكنك الإلغاء في أي وقت من حسابك، ويستمر الدخول حتى نهاية الفترة المدفوعة.", "الاشتراك شخصي وغير قابل للتحويل، ويحق للموظفين التحقق من بطاقة العضوية عند الاستقبال.", "في حال فشل دفعة التجديد، قد يستمر الدخول لفترة سماح قصيرة أثناء إعادة محاولة الدفع، ثم يتم تعليق الاشتراك."] },
      { h: "4. الصحة والسلامة", p: ["ينطوي التدريب البدني على مخاطر طبيعية. استشر طبيبك قبل البدء بأي برنامج تدريبي أو مكملات غذائية. التزم بتعليمات الموظفين واستخدم المعدات بشكل صحيح، وأبلغ المدرب بأي حالة صحية قد تؤثر على تدريبك."] },
      { h: "5. متجر المكملات", p: ["أوصاف المنتجات لأغراض المعلومات فقط ولا تُعد استشارة طبية. الأسعار بالدينار الأردني وقابلة للتغيير، ويُعتمد السعر الظاهر عند إتمام الطلب. تخضع الطلبات لتوفر المخزون."] },
      { h: "6. الدفع", p: ["تتم معالجة مدفوعات الاشتراكات بالبطاقة عبر مزوّد الدفع بصفته التاجر المسجل، وتسري شروطه على العملية. لا نقوم بتخزين أرقام البطاقات الكاملة."] },
      { h: "7. المسؤولية", p: ["في حدود ما يسمح به القانون الأردني، لا نتحمل المسؤولية عن الخسائر غير المباشرة أو فقدان المقتنيات الشخصية داخل المرفق. ولا يحدّ أي بند من هذه الشروط من مسؤولية لا يجوز تحديدها قانوناً."] },
      { h: "8. القانون الواجب التطبيق", p: ["تخضع هذه الشروط لقوانين المملكة الأردنية الهاشمية، وتختص محاكم عمّان بالنظر في أي نزاع."] },
    ],
  },
  privacy: {
    en: [
      { h: "1. Data we collect", p: ["Account data (name, email, profile photo from Google, phone), membership and order history, delivery address, check-in records, and technical logs needed to run the site securely."] },
      { h: "2. Why we use it", p: ["To provide memberships and orders, verify access at the front desk, contact you about your orders, prevent fraud, and meet legal obligations. We do not sell your data."] },
      { h: "3. Who we share it with", p: ["Service providers that operate the site on our behalf: hosting and database, Google (sign-in), our payment provider (memberships), and our email provider. Each receives only what it needs."] },
      { h: "4. Cookies", p: ["We use strictly necessary cookies for sign-in sessions, language preference and security. We do not use advertising or analytics cookies. If that changes, we will ask for your consent first."] },
      { h: "5. Retention", p: ["Account data is kept while your account is active. Financial records are kept for the period required by Jordanian law. Check-in logs are kept for [12] months."] },
      { h: "6. Your rights", p: ["You can view and update your profile in your account and request deletion under Account → Settings. We will respond within 30 days. Contact: [privacy email]."] },
    ],
    ar: [
      { h: "1. البيانات التي نجمعها", p: ["بيانات الحساب (الاسم، البريد الإلكتروني، صورة الملف من Google، رقم الهاتف)، وسجل الاشتراكات والطلبات، وعنوان التوصيل، وسجلات الدخول إلى النادي، والسجلات التقنية اللازمة لتشغيل الموقع بأمان."] },
      { h: "2. أغراض الاستخدام", p: ["تقديم الاشتراكات والطلبات، والتحقق من الدخول عند الاستقبال، والتواصل معك بشأن طلباتك، ومنع الاحتيال، والوفاء بالالتزامات القانونية. نحن لا نبيع بياناتك."] },
      { h: "3. مع من نشاركها", p: ["مزوّدو الخدمات الذين يشغّلون الموقع نيابةً عنا: الاستضافة وقاعدة البيانات، وGoogle (تسجيل الدخول)، ومزوّد الدفع (الاشتراكات)، ومزوّد البريد الإلكتروني. يحصل كل منهم فقط على ما يحتاجه."] },
      { h: "4. ملفات تعريف الارتباط", p: ["نستخدم ملفات ارتباط ضرورية فقط لجلسات تسجيل الدخول وتفضيل اللغة والأمان. لا نستخدم ملفات ارتباط إعلانية أو تحليلية، وفي حال تغيّر ذلك سنطلب موافقتك أولاً."] },
      { h: "5. مدة الاحتفاظ", p: ["نحتفظ ببيانات الحساب طالما كان الحساب فعّالاً، وبالسجلات المالية للمدة التي يفرضها القانون الأردني، وبسجلات الدخول لمدة [12] شهراً."] },
      { h: "6. حقوقك", p: ["يمكنك عرض بياناتك وتحديثها من حسابك، وطلب الحذف من الحساب ← الإعدادات. سنرد خلال 30 يوماً. للتواصل: [البريد الخاص بالخصوصية]."] },
    ],
  },
  refunds: {
    en: [
      { h: "1. Memberships", p: ["You can cancel an online membership at any time from your account. Cancellation stops future renewals; access continues until the end of the paid period. Partial periods are not refunded except where required by law or at our discretion (e.g. medical reasons with documentation).", "If you were charged in error, contact us within 14 days and we will refund the charge."] },
      { h: "2. Supplements", p: ["Unopened, sealed products in their original condition can be returned within 7 days of pickup or delivery. For hygiene and safety reasons, opened supplements cannot be returned unless they are defective or not as described.", "Refunds for card payments are returned to the original card; cash payments are refunded at the gym."] },
      { h: "3. How to request", p: ["Contact us on 079 555 6818 or WhatsApp with your order number or account email."] },
    ],
    ar: [
      { h: "1. الاشتراكات", p: ["يمكنك إلغاء الاشتراك الإلكتروني في أي وقت من حسابك. يوقف الإلغاء التجديدات القادمة ويستمر الدخول حتى نهاية الفترة المدفوعة. لا تُسترد قيمة الفترات الجزئية إلا إذا اقتضى القانون ذلك أو وفق تقديرنا (مثل الأسباب الطبية الموثقة).", "في حال تم خصم مبلغ عن طريق الخطأ، تواصل معنا خلال 14 يوماً وسنقوم برد المبلغ."] },
      { h: "2. المكملات", p: ["يمكن إرجاع المنتجات المغلقة وغير المفتوحة بحالتها الأصلية خلال 7 أيام من الاستلام أو التوصيل. لأسباب صحية وتتعلق بالسلامة، لا يمكن إرجاع المكملات المفتوحة إلا إذا كانت معيبة أو مخالفة للوصف.", "تُعاد المبالغ المدفوعة بالبطاقة إلى البطاقة نفسها، وتُرد المدفوعات النقدية في النادي."] },
      { h: "3. طريقة الطلب", p: ["تواصل معنا على 079 555 6818 أو عبر واتساب مع رقم الطلب أو البريد الإلكتروني للحساب."] },
    ],
  },
  shipping: {
    en: [
      { h: "1. Pickup at the gym", p: ["Free. We will message you when your order is ready. Bring your order number. Orders not collected within 14 days may be cancelled and refunded."] },
      { h: "2. Delivery in Amman", p: ["We currently deliver within Amman only. A delivery fee is shown at checkout. Typical delivery time is 1–3 working days. Cash on delivery is available."] },
      { h: "3. Checks on arrival", p: ["Please check the package on delivery and report damaged or missing items within 48 hours."] },
    ],
    ar: [
      { h: "1. الاستلام من النادي", p: ["مجاني. سنرسل لك رسالة عندما يصبح طلبك جاهزاً، يرجى إحضار رقم الطلب. قد يتم إلغاء الطلبات غير المستلمة خلال 14 يوماً ورد قيمتها."] },
      { h: "2. التوصيل داخل عمّان", p: ["نوفّر التوصيل داخل عمّان فقط حالياً، وتظهر رسوم التوصيل عند إتمام الطلب. مدة التوصيل المعتادة من يوم إلى 3 أيام عمل، ويتوفر الدفع نقداً عند التوصيل."] },
      { h: "3. الفحص عند الاستلام", p: ["يرجى فحص الطرد عند الاستلام والإبلاغ عن أي منتجات تالفة أو ناقصة خلال 48 ساعة."] },
    ],
  },
};
