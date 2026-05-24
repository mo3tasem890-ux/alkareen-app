# توثيق عملية بناء وإصدار تطبيق الكرين 🇸🇩 (الإصدار 1.6.9 / كود 28)

تم الانتهاء بنجاح من دمج وتأكيد كافة الإصلاحات البرمجية وضبط معرّفات Google AdMob الإنتاجية الحقيقية وتوليد الحزمة النهائية بنجاح عبر خوادم Expo EAS.

---

## 🛠️ التغييرات والتحسينات البرمجية التي تم تطبيقها

### 1. معرّفات إعلانات AdMob الحقيقية (Production IDs)
* **معرف التطبيق (App ID):** تم تثبيته بالكامل ليكون `ca-app-pub-2559389808587750~9607811170` في ملف الإعدادات `app.json` وملف أندرويد الأصلي `AndroidManifest.xml`.
* **معرف الوحدة الإعلانية للبنر (Banner Ad Unit ID):** تم دمجه في كود `App.js` و `App_MD.js` ليكون `ca-app-pub-2559389808587750/7889359222`.
* **توثيق النطاق `app-ads.txt`:** تم ضبطه بشكل مطابق للسطر الإنتاجي المعتمد:
  ```text
  google.com, pub-2559389808587750, DIRECT, f08c47fec0942fa0
  ```

### 2. ميزة التمرير وضبط الواجهة (Tab Scroll Reset Fix)
* تم إضافة ربط برمي مرن للـ `FlatList` عبر `flatListRef` ومراقبة التغير في التبويب الحالي `tab`.
* عند التبديل بين التبويبات (للبيع، للإيجار، مفقودة، معثور عليها)، يتم تلقائياً إعادة التمرير إلى الأعلى لتجنب الاحتفاظ بموضع التمرير القديم ولتجنب شوشرة الشاشة أو اهتزازها.
  ```javascript
  const flatListRef = useRef(null);

  useEffect(() => {
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: false });
    }
  }, [tab]);
  ```

### 3. نظام الإخفاء التلقائي للإعلانات في حال فشل التحميل
* لتأمين تجربة مستخدم خالية من أي تشوهات بصرية، تم برمجة مكون `BottomBannerAd` ليتعامل تلقائياً مع الأخطاء:
  * يختفي البنر تماماً (يتقلص الارتفاع والهوامش إلى `0`) في حال فشل تحميل الإعلان من خوادم AdMob أو قبل تحميله.
  ```javascript
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    <View style={[styles.bottomAdContainer, !loaded && { height: 0, paddingVertical: 0, borderTopWidth: 0 }]}>
      <BannerAd ... />
    </View>
  );
  ```

### 4. ترقية رقم الإصدار وتحسين الرفع
* تم ترقية الإصدار إلى **`versionCode: 28`** لضمان قبوله في Google Play Console.
* تم تحسين ملف التثبيتات `.easignore` لتجنب رفع المجلدات الكبيرة مثل `node_modules` محلياً، مما يسرّع العملية بشكل هائل.

---

## 📦 تفاصيل حزمة الـ AAB الجاهزة للتحميل

> [!IMPORTANT]
> تم بناء الملف بشكل رسمي ونظيف عبر خوادم Expo السحابية وهو متوافق تماماً وموقع رقمياً بنفس بصمة credentials التطبيق الحالية.

* **رابط التحميل المباشر للملف (AAB):**
  🔗 [تحميل ملف الكرين (الإصدار 1.6.9 / كود 28)](https://expo.dev/artifacts/eas/jYwAKKiwF1Dd7duf1gdtAk.aab)
* **صفحة سجل البناء لمتابعة التفاصيل:**
  🔗 [سجل البناء على خوادم Expo](https://expo.dev/accounts/motasem890/projects/vehicle-finder-app/builds/99a90122-91bc-4b07-aaab-db9eff2d45e3)
