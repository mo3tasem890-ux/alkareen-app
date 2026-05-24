import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Linking,
  Share,
  RefreshControl,
  FlatList,
  Animated,
  UIManager,
  LayoutAnimation,
  Dimensions,
  Easing,
} from 'react-native';
import mobileAds, { BannerAd, BannerAdSize, TestIds, AdsConsent } from 'react-native-google-mobile-ads';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import ImageViewer from 'react-native-image-zoom-viewer';

// Firebase imports
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  doc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  getDoc,
  limit,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Firebase configuration - REPLACE WITH YOUR ACTUAL CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyD5H-WeEu0bRNZOsMZ4aawCmTXAFh71GmQ",
  authDomain: "al-kreen.firebaseapp.com",
  projectId: "al-kreen",
  storageBucket: "al-kreen.firebasestorage.app",
  messagingSenderId: "422837108314",
  appId: "1:422837108314:android:57153e8e0cd8bb7028a263"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Main App Component - بدون تسجيل دخول
export default function App() {
  return <MainApp />;
}

// Main App Component (بدون تسجيل دخول)
function MainApp() {
  const [title, setTitle] = useState('');
  const [model, setModel] = useState('');
  const [vin, setVin] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [rentPrice, setRentPrice] = useState('');
  const [images, setImages] = useState([]);
  const [location, setLocation] = useState(null);
  const [deviceName, setDeviceName] = useState('مستخدم');
  const [refreshing, setRefreshing] = useState(false);

  // حقول جديدة للإيجار
  const [rentalPeriod, setRentalPeriod] = useState('');
  const [contractType, setContractType] = useState('يومي');
  const [deposit, setDeposit] = useState('');

  const [lostPosts, setLostPosts] = useState([]);
  const [foundPosts, setFoundPosts] = useState([]);
  const [salePosts, setSalePosts] = useState([]);
  const [rentPosts, setRentPosts] = useState([]);
  const [tab, setTab] = useState('lost');

  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentPostImages, setCurrentPostImages] = useState([]);
  const [duplicateModalPost, setDuplicateModalPost] = useState(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sortMode, setSortMode] = useState('newest'); // 'newest', 'oldest', 'priceLow', 'priceHigh'
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const toggleLike = async (item) => {
    if (!myDeviceId) return;
    
    const collectionName = 
      item.type === 'lost' ? 'lostPosts' : 
      item.type === 'found' ? 'foundPosts' : 
      item.type === 'sale' ? 'salePosts' : 'rentPosts';
    
    const postRef = doc(db, collectionName, item.id);
    const isLiked = item.likedBy && item.likedBy.includes(myDeviceId);
    
    try {
      // Use LayoutAnimation for smooth heart fill
      LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
      await updateDoc(postRef, {
        likedBy: isLiked ? arrayRemove(myDeviceId) : arrayUnion(myDeviceId)
      });
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  // Optimized Breathing Animation
  const fabAnim = useRef(new Animated.Value(1)).current;

  const flatListRef = useRef(null);

  useEffect(() => {
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: false });
    }
  }, [tab]);

  const [postLimit, setPostLimit] = useState(20);
  const [myDeviceId, setMyDeviceId] = useState(null);
  const [ownedPostIds, setOwnedPostIds] = useState(new Set());

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fabAnim, {
          toValue: 1.06,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(fabAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [fabAnim]);

  // Enable LayoutAnimation for Android
  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  // Initialize Mobile Ads and Request Consent
  useEffect(() => {
    const initializeAds = async () => {
      // 1. Try to handle GDPR consent request (does not block initialization on failure)
      try {
        const consentInfo = await AdsConsent.requestInfoUpdate();
        if (consentInfo.isConsentFormAvailable && consentInfo.status === 'REQUIRED') {
          await AdsConsent.showForm();
        }
      } catch (consentError) {
        console.log('Consent flow skipped/failed:', consentError);
      }

      // 2. Always initialize mobileAds
      try {
        await mobileAds().initialize();
        console.log('Google Mobile Ads initialized successfully');
      } catch (e) {
        console.log('Ads initialization failed:', e);
      }
    };
    initializeAds();
  }, []);

  // Load device data and set up deep links
  useEffect(() => {
    const initializeAppData = async () => {
      // Get device name
      try {
        const name = Device.deviceName || (await Device.getDeviceNameAsync?.()) || Device.modelName || 'مستخدم';
        setDeviceName(name);
      } catch (error) {
        console.log('Could not get device name:', error);
        setDeviceName('مستخدم');
      }

      // Generate device ID if not exists
      let deviceId = await AsyncStorage.getItem('deviceId');
      if (!deviceId) {
        deviceId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        await AsyncStorage.setItem('deviceId', deviceId);
      }
      setMyDeviceId(deviceId);

      // Pre-fetch ownership keys from local storage
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const ownerKeys = allKeys.filter(k => k.startsWith('post_owner_'));
        const ownedIds = new Set(ownerKeys.map(k => k.replace('post_owner_', '')));
        setOwnedPostIds(ownedIds);
      } catch (e) {
        console.log('Error fetching local ownership:', e);
      }
    };

    initializeAppData();

    const subscription = Linking.addEventListener('url', handleDeepLink);
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  // Separate effect for real-time listeners that depends on postLimit
  useEffect(() => {
    const unsub = setupRealTimeListeners();
    return () => unsub && unsub();
  }, [postLimit]);

  // Set up real-time listeners for all collections
  const setupRealTimeListeners = () => {
    // Lost posts listener
    const lostQuery = query(collection(db, 'lostPosts'), orderBy('createdAt', 'desc'), limit(postLimit));
    const lostUnsubscribe = onSnapshot(lostQuery, (snapshot) => {
      const lostPostsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        uniqueKey: `lost_${doc.id}`
      }));
      setLostPosts(lostPostsData);
    }, (error) => {
      console.error('Error in lost posts listener:', error);
    });

    // Found posts listener
    const foundQuery = query(collection(db, 'foundPosts'), orderBy('createdAt', 'desc'), limit(postLimit));
    const foundUnsubscribe = onSnapshot(foundQuery, (snapshot) => {
      const foundPostsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        uniqueKey: `found_${doc.id}`
      }));
      setFoundPosts(foundPostsData);
    }, (error) => {
      console.error('Error in found posts listener:', error);
    });

    // Sale posts listener
    const saleQuery = query(collection(db, 'salePosts'), orderBy('createdAt', 'desc'), limit(postLimit));
    const saleUnsubscribe = onSnapshot(saleQuery, (snapshot) => {
      const salePostsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        uniqueKey: `sale_${doc.id}`
      }));
      setSalePosts(salePostsData);
    }, (error) => {
      console.error('Error in sale posts listener:', error);
    });

    // Rent posts listener
    const rentQuery = query(collection(db, 'rentPosts'), orderBy('createdAt', 'desc'), limit(postLimit));
    const rentUnsubscribe = onSnapshot(rentQuery, (snapshot) => {
      const rentPostsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        uniqueKey: `rent_${doc.id}`
      }));
      setRentPosts(rentPostsData);
      setLoading(false);
    }, (error) => {
      console.error('Error in rent posts listener:', error);
      setLoading(false);
    });

    // Return cleanup function
    return () => {
      lostUnsubscribe();
      foundUnsubscribe();
      saleUnsubscribe();
      rentUnsubscribe();
    };
  };

  // (SkeletonCard moved outside MainApp)

  // Function to handle deep links
  const handleDeepLink = (event) => {
    const url = event.url;
    console.log('Deep link received:', url);

    const postId = url.split('/').pop();
    if (postId) {
      const allPosts = [
        ...lostPosts,
        ...foundPosts,
        ...salePosts,
        ...rentPosts,
      ];
      const post = allPosts.find((p) => p.id === postId);

      if (post) {
        setTab(post.type);
        Alert.alert(
          'منشور معين',
          `تم فتح منشور في قسم ${post.type === 'lost'
            ? 'المفقودة'
            : post.type === 'found'
              ? 'الموجودة'
              : post.type === 'sale'
                ? 'للبيع'
                : 'للإيجار'
          }`,
          [{ text: 'حسناً' }]
        );
      }
    }
  };

  // Function to upload images to Firebase Storage
  const uploadImages = async (imageUris) => {
    try {
      const uploadedImageUrls = [];

      for (const uri of imageUris) {
        // Convert URI to blob
        const response = await fetch(uri);
        const blob = await response.blob();

        // Create a unique filename
        const filename = `images/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const storageRef = ref(storage, filename);

        // Upload the image
        const snapshot = await uploadBytes(storageRef, blob);

        // Get the download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        uploadedImageUrls.push(downloadURL);
      }

      return uploadedImageUrls;
    } catch (error) {
      console.error('Error uploading images:', error);
      throw error;
    }
  };

  // Refresh function
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Force reload by re-setting up listeners
    setupRealTimeListeners();
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  // FIXED: Function to convert Arabic numbers to English for consistency
  const convertToEnglishNumbers = (text) => {
    if (!text) return '';

    const arabicToEnglishMap = {
      '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
      '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
    };

    return text.replace(/[٠١٢٣٤٥٦٧٨٩]/g, (match) => arabicToEnglishMap[match]);
  };

  // FIXED: Function to format price with commas for Sudanese pounds
  const formatSudanesePrice = (priceText) => {
    if (!priceText) return '';

    const englishNumbers = convertToEnglishNumbers(priceText);
    const numericValue = englishNumbers.replace(/\D/g, '');

    if (numericValue) {
      return numericValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    return '';
  };

  // FIXED: VIN normalization with proper Arabic number conversion
  const normalizeVIN = (s) => {
    if (!s) return '';
    const englishOnly = convertToEnglishNumbers(s);
    return englishOnly.replace(/\s+/g, '').toUpperCase();
  };

  const findExistingByVIN = (lost, found, sale, rent, rawVin) => {
    const target = normalizeVIN(rawVin);
    if (!target) return null;
    const inLost = lost.find((p) => normalizeVIN(p.vin) === target);
    if (inLost) return { list: 'lost', post: inLost };
    const inFound = found.find((p) => normalizeVIN(p.vin) === target);
    if (inFound) return { list: 'found', post: inFound };
    return null;
  };

  const openMaps = (loc) => {
    if (!loc) return;
    const url = `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`;
    Linking.openURL(url);
  };

  const makePhoneCall = (phoneNumber) => {
    if (!phoneNumber) return;
    const url = `tel:${phoneNumber}`;
    Linking.openURL(url);
  };

  // Sharing function with deep link to post
  const sharePost = async (post) => {
    try {
      const deepLink = `alkreen://post/${post.id}`;
      const playStoreLink = 'https://play.google.com/store/apps/details?id=com.yourname.vehiclefinder';

      const shareContent = {
        message: `🚗 ${post.title} (${post.model})\n${post.description ? `${post.description}\n` : ''}${post.vin ? `رقم الشاسى: ${post.vin}\n` : ''}${post.phone ? `📞 ${post.phone}\n` : ''}${post.price ? `💰 ${post.type === 'rent' ? 'سعر الإيجار: ' : 'السعر: '}${post.price}${post.type === 'rent' && post.rentalPeriod ? ` لكل ${post.rentalPeriod}` : ''} جنيه سوداني\n` : ''}🔗 ${deepLink}\n\nإذا لم يتم فتح التطبيق تلقائياً، قم بتحميله من هنا:\n${playStoreLink}`,
        title: `معلومات عن ${post.title} ${post.model}`,
      };

      const result = await Share.share(shareContent);

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          console.log('Shared with', result.activityType);
        } else {
          console.log('Shared successfully');
        }
      } else if (result.action === Share.dismissedAction) {
        console.log('Share dismissed');
      }
    } catch (error) {
      Alert.alert('خطأ', 'حدث خطأ أثناء مشاركة المنشور');
      console.error('Error sharing post:', error);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Please allow access to your photos to continue');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      allowsMultipleSelection: true,
    });

    if (!result.canceled && result.assets) {
      const newImages = result.assets.map((asset) => asset.uri);
      const totalImages = images.length + newImages.length;
      if (totalImages > 3) {
        Alert.alert('تنبيه', 'يمكنك إضافة 3 صور كحد أقصى للمنشور الواحد');
        // Only add up to 3 images total
        const allowedNewCount = 3 - images.length;
        if (allowedNewCount <= 0) return;
        setImages((prev) => [...prev, ...newImages.slice(0, allowedNewCount)].filter(Boolean));
      } else {
        setImages((prev) => [...prev, ...newImages].filter(Boolean));
      }
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Please allow camera access to continue');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      if (images.length >= 3) {
        Alert.alert('تنبيه', 'يمكنك إضافة 3 صور كحد أقصى للمنشور الواحد');
        return;
      }
      setImages((prev) => [...prev, result.assets[0].uri].filter(Boolean));
    }
  };

  const removeImageAt = (idx) => setImages((prev) => prev.filter((_, i) => i !== idx));

  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('إذن الموقع مرفوض', 'يرجى تفعيل صلاحية الموقع للمواصلة.');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    setLocation({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    });
  };

  // Search function - handles both Arabic and English numbers
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setIsSearching(false);
      return;
    }

    const normalizedQuery = convertToEnglishNumbers(searchQuery.toLowerCase());
    const allPosts = [...lostPosts, ...foundPosts, ...salePosts, ...rentPosts];

    const results = allPosts.filter(
      (post) =>
        post.title.toLowerCase().includes(normalizedQuery) ||
        post.model.toLowerCase().includes(normalizedQuery) ||
        (post.vin && normalizeVIN(post.vin).includes(normalizedQuery)) ||
        (post.description && post.description.toLowerCase().includes(normalizedQuery)) ||
        (post.price && convertToEnglishNumbers(post.price).includes(normalizedQuery)) ||
        (post.rentalPeriod && post.rentalPeriod.toLowerCase().includes(normalizedQuery))
    );

    setSearchResults(results);
    setIsSearching(true);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    setSearchResults([]);
  };

  // Function to open image gallery with navigation
  const openImageGallery = (postImages, index) => {
    setCurrentPostImages(postImages.map(img => ({ url: img })));
    setCurrentImageIndex(index);
    setImageModalVisible(true);
  };

  // Function to navigate between images in the modal
  const navigateImage = (direction) => {
    if (direction === 'next') {
      setCurrentImageIndex((prevIndex) =>
        prevIndex < currentPostImages.length - 1 ? prevIndex + 1 : 0
      );
    } else {
      setCurrentImageIndex((prevIndex) =>
        prevIndex > 0 ? prevIndex - 1 : currentPostImages.length - 1
      );
    }
  };

  // Delete post function that actually removes from Firestore
  const deletePost = async (postId, postType) => {
    try {
      let collectionName;
      switch (postType) {
        case 'lost': collectionName = 'lostPosts'; break;
        case 'found': collectionName = 'foundPosts'; break;
        case 'sale': collectionName = 'salePosts'; break;
        case 'rent': collectionName = 'rentPosts'; break;
        default: return;
      }

      const deviceId = await AsyncStorage.getItem('deviceId');

      // Use the Firestore document ID
      const postRef = doc(db, collectionName, postId);

      // First check if the document exists
      const postDoc = await getDoc(postRef);

      if (!postDoc.exists()) {
        Alert.alert('خطأ', 'المنشور غير موجود أو تم حذفه مسبقاً');
        return;
      }

      const postData = postDoc.data();

      // Verify ownership before deletion
      if (postData.creatorDeviceId !== deviceId) {
        Alert.alert('خطأ', 'ليس لديك صلاحية لحذف هذا المنشور');
        return;
      }

      // ACTUALLY DELETE THE DOCUMENT FROM FIRESTORE
      await deleteDoc(postRef);

      // Delete from local storage ownership
      await AsyncStorage.removeItem(`post_owner_${postId}`);

      Alert.alert('نجاح', 'تم حذف المنشور بنجاح');

    } catch (error) {
      console.error('Error deleting post:', error);

      if (error.code === 'not-found') {
        Alert.alert('خطأ', 'المنشور غير موجود أو تم حذفه مسبقاً');
      } else if (error.code === 'permission-denied') {
        Alert.alert('خطأ', 'ليس لديك صلاحية لحذف هذا المنشور');
      } else {
        Alert.alert('خطأ', 'حدث خطأ أثناء حذف المنشور');
      }
    }
  };

  const clearForm = () => {
    setTitle('');
    setModel('');
    setVin('');
    setDescription('');
    setPhone('');
    setSalePrice('');
    setRentPrice('');
    setImages([]);
    setLocation(null);
    setRentalPeriod('');
    setContractType('يومي');
    setDeposit('');
  };

  const handleSubmit = async () => {
    // Get or generate device ID
    let deviceId = await AsyncStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      await AsyncStorage.setItem('deviceId', deviceId);
    }

    // For lost/found tabs, VIN is required
    if ((tab === 'lost' || tab === 'found') && !vin) {
      Alert.alert('حقول ناقصة', 'يرجى إدخال رقم الشاسى (VIN) للسيارة.');
      return;
    }

    if (!title || !model) {
      Alert.alert('حقول ناقصة', 'يرجى إدخال نوع السيارة والموديل.');
      return;
    }

    // For lost/found tabs, description is now mandatory
    if ((tab === 'lost' || tab === 'found') && !description) {
      Alert.alert('حقول ناقصة', 'يرجى إدخال وصف للسيارة (إجباري للسيارات المفقودة والموجودة).');
      return;
    }

    // For sale/rent tabs, price is required
    if (tab === 'sale' && !salePrice) {
      Alert.alert('حقول ناقصة', 'يرجى إدخال سعر السيارة.');
      return;
    }

    if (tab === 'rent' && !rentPrice) {
      Alert.alert('حقول ناقصة', 'يرجى إدخال سعر إيجار السيارة.');
      return;
    }

    // For rent tab, rental period is required
    if (tab === 'rent' && !rentalPeriod) {
      Alert.alert('حقول ناقصة', 'يرجى إدخال مدة الإيجار.');
      return;
    }

    // Check for duplicate VIN only for lost/found tabs
    if (tab !== 'sale' && tab !== 'rent') {
      const vinNorm = normalizeVIN(vin);
      const dup = findExistingByVIN(lostPosts, foundPosts, salePosts, rentPosts, vinNorm);

      if (dup) {
        setDuplicateModalPost(dup.post);
        setShowDuplicateModal(true);
        Alert.alert(
          'تنبيه',
          `رقم الشاسى (VIN) ${vinNorm} موجود مسبقًا في قسم ${dup.list === 'lost' ? 'المفقودة' : 'الموجودة'}.`,
          [
            { text: 'عرض التفاصيل', onPress: () => setShowDuplicateModal(true) },
            { text: 'إغلاق', style: 'cancel', onPress: () => setShowDuplicateModal(false) },
          ]
        );
        return;
      }
    }

    // Show loading indicator
    Alert.alert('جاري الرفع', 'جاري رفع الصور وإضافة المنشور...');

    try {
      // Upload images to Firebase Storage
      let uploadedImageUrls = [];
      if (images.length > 0) {
        uploadedImageUrls = await uploadImages(images);
      }

      const priceToUse = tab === 'sale' ? salePrice : rentPrice;

      const newPost = {
        title: title.trim(),
        model: model.trim(),
        vin: tab === 'sale' || tab === 'rent' ? '' : normalizeVIN(vin),
        description: description.trim(),
        phone: phone.trim(),
        price: (tab === 'sale' || tab === 'rent') ? formatSudanesePrice(priceToUse) + ' جنيه سوداني' : '',
        images: uploadedImageUrls,
        location: location ? { ...location } : null,
        createdAt: new Date().toISOString(),
        type: tab,
        userName: deviceName,
        creatorDeviceId: deviceId,

        // حقول الإيجار الإضافية
        ...(tab === 'rent' && {
          rentalPeriod: rentalPeriod.trim(),
          contractType: contractType,
          deposit: deposit ? formatSudanesePrice(deposit) + ' جنيه سوداني' : '',
        }),
        lastBumpedAt: new Date().toISOString(),
        likedBy: [], // Initializing likes array
      };

      // Save to Firestore based on post type
      let collectionName;
      switch (tab) {
        case 'lost': collectionName = 'lostPosts'; break;
        case 'found': collectionName = 'foundPosts'; break;
        case 'sale': collectionName = 'salePosts'; break;
        case 'rent': collectionName = 'rentPosts'; break;
        default: collectionName = 'posts';
      }

      // Add document and get the reference
      const docRef = await addDoc(collection(db, collectionName), newPost);

      // Store ownership locally using Firestore document ID
      await AsyncStorage.setItem(`post_owner_${docRef.id}`, 'true');

      // Reset form
      clearForm();

      Alert.alert('✅ نجاح', 'تمت إضافة المنشور بنجاح');
      setShowAddModal(false); // Close automatically
    } catch (error) {
      console.error('Error saving post to Firestore:', error);
      Alert.alert('❌ خطأ', 'حدث خطأ أثناء حفظ المنشور');
    }
  };

  // Function to "Bump" a post (refresh its position)
  const bumpPost = async (postId, collectionType, lastBumpedAt) => {
    const now = new Date();
    const lastBump = lastBumpedAt ? new Date(lastBumpedAt) : new Date(0);
    const diffHours = (now - lastBump) / (1000 * 60 * 60);

    if (diffHours < 24) {
      const remainingHours = Math.ceil(24 - diffHours);
      Alert.alert('⏳ انتظر قليلاً', `يمكنك رفع هذا المنشور مرة أخرى بعد ${remainingHours} ساعة.`);
      return;
    }

    try {
      let collectionName;
      switch (collectionType) {
        case 'lost': collectionName = 'lostPosts'; break;
        case 'found': collectionName = 'foundPosts'; break;
        case 'sale': collectionName = 'salePosts'; break;
        case 'rent': collectionName = 'rentPosts'; break;
        default: collectionName = 'posts';
      }

      const postRef = doc(db, collectionName, postId);
      const newTimestamp = new Date().toISOString();
      await updateDoc(postRef, {
        createdAt: newTimestamp,
        lastBumpedAt: newTimestamp
      });

      Alert.alert('🚀 نجاح', 'تم رفع المنشور إلى القمة بنجاح!');
    } catch (error) {
      console.error('Error bumping post:', error);
      Alert.alert('❌ خطأ', 'فشل في رفع المنشور');
    }
  };

  // (PostCard moved outside MainApp)

  const closeMenus = () => {
    setShowSortMenu(false);
    setShowNotifications(false);
  };

  const currentList = tab === 'lost' ? lostPosts :
    tab === 'found' ? foundPosts :
      tab === 'sale' ? salePosts : rentPosts;

  // Apply Sorting
  const getSortedList = (list) => {
    if (sortMode === 'newest') return list;
    
    return [...list].sort((a, b) => {
      if (sortMode === 'oldest') {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }
      if (sortMode === 'newest') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }

      // Simple price extraction (assuming format like "1,000,000 جنيه")
      const getPrice = (p) => parseInt(p?.replace(/[^0-9]/g, '') || '0');
      const priceA = getPrice(a.price);
      const priceB = getPrice(b.price);
      
      if (sortMode === 'priceLow') return priceA - priceB;
      if (sortMode === 'priceHigh') return priceB - priceA;
      return 0;
    });
  };

  const displayList = useMemo(() => {
    const list = isSearching ? searchResults : getSortedList(currentList);
    
    // Safety check: if no items, return empty
    if (!list || list.length === 0) return [];

    // Inject Ads every 5 items with stable keys
    const listWithAds = [];
    list.forEach((item, index) => {
      listWithAds.push(item);
      // Insert ad after every 5 items
      if ((index + 1) % 5 === 0) {
        listWithAds.push({ 
          isAd: true, 
          id: `ad_slot_${index}`, // Use 'id' as a backup
          uniqueKey: `ad_slot_${tab}_${index}` 
        });
      }
    });
    return listWithAds;
  }, [isSearching, searchResults, currentList, sortMode, tab]);

  const loadMore = () => {
    if (!loading && !isSearching) {
      setPostLimit(prev => prev + 20);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* 1. Sticky Header Section */}
        <View style={{ backgroundColor: '#F0F2F5', paddingHorizontal: 16, paddingTop: 10, zIndex: 10 }}>
          <View style={styles.headerContainer}>
            <View style={styles.headerRow}>
              <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={closeMenus} activeOpacity={1}>
                <Text style={[styles.header, { flex: 1, textAlign: 'right' }]}>الكرين 🇸🇩</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.headerIconBtn} 
                onPress={() => setShowNotifications(!showNotifications)}
              >
                <Ionicons name="notifications-outline" size={26} color="#0866FF" />
                <View style={styles.notifBadge} />
              </TouchableOpacity>
            </View>
            <View style={styles.headerLine} />
          </View>

          {/* Modern Search Bar */}
          <View style={styles.modernSearchContainer}>
            <Ionicons name="search" size={20} color="#8899A6" style={styles.modernSearchIcon} />
            <TextInput
              placeholder="ابحث عن (نوع، موديل، رقم الشاسى)..."
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (text === '') clearSearch();
              }}
              style={styles.modernSearchInput}
              onSubmitEditing={handleSearch}
              placeholderTextColor="#8899A6"
              returnKeyType="search"
            />
            {isSearching && (
              <TouchableOpacity style={styles.modernClearSearchBtn} onPress={clearSearch}>
                <Ionicons name="close-circle" size={20} color="#8899A6" />
              </TouchableOpacity>
            )}
            <View style={{ width: 1, height: 24, backgroundColor: '#CED0D4', marginHorizontal: 8 }} />
            <TouchableOpacity 
              style={styles.filterToggleBtn} 
              onPress={() => setShowSortMenu(!showSortMenu)}
            >
              <Ionicons name="filter-outline" size={22} color="#0866FF" />
              <Text style={styles.filterBtnText}>فرز</Text>
            </TouchableOpacity>
          </View>
          
          {/* Overlay to catch taps outside menus */}
          {(showSortMenu || showNotifications) && (
            <TouchableOpacity 
              style={StyleSheet.absoluteFill} 
              activeOpacity={1} 
              onPress={closeMenus} 
            />
          )}

          {/* Custom Sort Menu Dropdown */}
          {showSortMenu && (
            <View style={[styles.sortMenu, { top: 110 }]}>
              {(tab === 'lost' || tab === 'found') ? (
                <>
                  <TouchableOpacity style={styles.sortMenuItem} onPress={() => { setSortMode('newest'); setShowSortMenu(false); }}>
                    <Ionicons name="time" size={18} color={sortMode === 'newest' ? '#0866FF' : '#65676B'} />
                    <Text style={[styles.sortMenuText, sortMode === 'newest' && styles.activeSortText]}>الأحدث أولاً</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.sortMenuItem} onPress={() => { setSortMode('oldest'); setShowSortMenu(false); }}>
                    <Ionicons name="hourglass" size={18} color={sortMode === 'oldest' ? '#0866FF' : '#65676B'} />
                    <Text style={[styles.sortMenuText, sortMode === 'oldest' && styles.activeSortText]}>الأقدم أولاً</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity style={styles.sortMenuItem} onPress={() => { setSortMode('newest'); setShowSortMenu(false); }}>
                    <Ionicons name="time" size={18} color={sortMode === 'newest' ? '#0866FF' : '#65676B'} />
                    <Text style={[styles.sortMenuText, sortMode === 'newest' && styles.activeSortText]}>الأحدث</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.sortMenuItem} onPress={() => { setSortMode('priceLow'); setShowSortMenu(false); }}>
                    <Ionicons name="trending-down" size={18} color={sortMode === 'priceLow' ? '#0866FF' : '#65676B'} />
                    <Text style={[styles.sortMenuText, sortMode === 'priceLow' && styles.activeSortText]}>الأرخص سعراً</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.sortMenuItem} onPress={() => { setSortMode('priceHigh'); setShowSortMenu(false); }}>
                    <Ionicons name="trending-up" size={18} color={sortMode === 'priceHigh' ? '#0866FF' : '#65676B'} />
                    <Text style={[styles.sortMenuText, sortMode === 'priceHigh' && styles.activeSortText]}>الأغلى سعراً</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          <View style={styles.modernTabsWrapper}>
            <View style={styles.modernTabsContainer}>
            {['sale', 'rent', 'lost', 'found'].map((t) => (
              <TouchableOpacity 
                key={t}
                style={[
                  styles.modernTab, 
                  tab === t && { 
                    backgroundColor: t === 'lost' ? '#ba1a1a' : t === 'found' ? '#34C759' : t === 'sale' ? '#0070eb' : '#FF9500',
                    borderColor: t === 'lost' ? '#ba1a1a' : t === 'found' ? '#34C759' : t === 'sale' ? '#0070eb' : '#FF9500',
                  }
                ]} 
                onPress={() => { 
                  closeMenus();
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); 
                  setTab(t); 
                  clearSearch(); 
                }}
              >
                <Animated.View style={[styles.tabInner, tab === t && { transform: [{ scale: fabAnim }] }]}>
                  <Ionicons 
                    name={t === 'lost' ? 'search-circle' : t === 'found' ? 'location' : t === 'sale' ? 'car' : 'calendar'} 
                    size={16} 
                    color={tab === t ? '#FFF' : '#44474d'} 
                  />
                  <Text 
                    style={[
                      styles.modernTabText, 
                      tab === t && styles.activeModernTabText,
                      t === 'found' && { fontSize: 9.5 } // Smaller for long text
                    ]} 
                    numberOfLines={1}
                  >
                    {t === 'lost' ? 'المفقودة' : t === 'found' ? 'المعثور عليها' : t === 'sale' ? 'للبيع' : 'للإيجار'}
                  </Text>
                </Animated.View>
              </TouchableOpacity>
            ))}
            </View>
          </View>
        </View>

        {/* 2. Scrollable Content */}
        <FlatList
          ref={flatListRef}
          onTouchStart={closeMenus}
          data={loading ? [1, 2, 3] : displayList}
          keyExtractor={(item, index) => loading ? `skeleton-${index}` : item.uniqueKey}
          renderItem={({ item }) => {
            if (loading) return <SkeletonCard />;
            
            // Handle Ad items
            if (item.isAd) {
              return <AdCard />;
            }
            
            // Handle Post items
            return (
              <PostCard 
                item={item} 
                myDeviceId={myDeviceId}
                ownedPostIds={ownedPostIds}
                onToggleLike={toggleLike}
                fabAnim={fabAnim}
                onOpenGallery={openImageGallery}
                onPhoneCall={makePhoneCall}
                onOpenMaps={openMaps}
                onShare={sharePost}
                onBump={bumpPost}
                onDelete={deletePost}
              />
            );
          }}
          contentContainerStyle={[styles.container, { paddingTop: 10 }]}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={5}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={Platform.OS === 'android'}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            !loading && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  {isSearching ? 'لم يتم العثور على نتائج' : 'لا توجد سيارات في هذا القسم بعد'}
                </Text>
              </View>
            )
          }
          ListHeaderComponent={
            <View>
              {isSearching ? (
                <View style={styles.sectionTitleContainer}>
                  <Ionicons name="search" size={24} color="#0866FF" style={{ marginLeft: 8 }} />
                  <Text style={styles.sectionTitle}>
                    {searchResults.length > 0 ? `نتائج البحث (${searchResults.length})` : 'لا توجد نتائج للبحث'}
                  </Text>
                </View>
              ) : (
                <View style={styles.sectionTitleContainer}>
                  <Ionicons 
                    name={tab === 'lost' ? 'megaphone' : tab === 'found' ? 'checkmark-circle' : tab === 'sale' ? 'pricetags' : 'key'} 
                    size={24} 
                    color="#0866FF" 
                    style={{ marginLeft: 8 }} 
                  />
                  <Text style={styles.sectionTitle}>
                    {tab === 'lost' ? 'السيارات المفقودة' :
                      tab === 'found' ? 'السيارات الموجودة' :
                        tab === 'sale' ? 'سيارات للبيع' : 'سيارات للإيجار'}
                  </Text>
                </View>
              )}
            </View>
          }
        />

        {/* Notification Dropdown Placeholder */}
        {showNotifications && (
          <View style={styles.notifDropdown}>
            <View style={styles.notifHeader}>
              <Text style={styles.notifTitle}>آخر التحديثات</Text>
              <TouchableOpacity onPress={() => setShowNotifications(false)}>
                <Ionicons name="close" size={24} color="#65676B" />
              </TouchableOpacity>
            </View>
            <View style={styles.notifItem}>
              <Ionicons name="car-outline" size={20} color="#0866FF" />
              <Text style={styles.notifText}>تمت إضافة سيارة تويوتا جديدة في قسم البيع</Text>
            </View>
            <View style={styles.notifItem}>
              <Ionicons name="checkmark-done-circle" size={20} color="#34C759" />
              <Text style={styles.notifText}>تم العثور على سيارة مفقودة في الخرطوم</Text>
            </View>
          </View>
        )}

        {/* معرض الصور مع إمكانية التنقل */}
          <Modal visible={imageModalVisible} transparent={true} onRequestClose={() => setImageModalVisible(false)}>
            <View style={{ flex: 1, backgroundColor: '#000' }}>
              <ImageViewer
                imageUrls={currentPostImages}
                index={currentImageIndex}
                enableSwipeDown={true}
                onSwipeDown={() => setImageModalVisible(false)}
                onChange={(index) => setCurrentImageIndex(index)}
                renderHeader={() => (
                  <TouchableOpacity style={styles.modalClose} onPress={() => setImageModalVisible(false)}>
                    <Text style={styles.modalCloseText}>✖</Text>
                  </TouchableOpacity>
                )}
                renderIndicator={() => null} // Hide default indicator to keep it clean
                renderImage={(props) => (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Image {...props} style={{ width: screenWidth, height: screenHeight * 0.7 }} />
                    <View style={styles.galleryWatermark}>
                      <Image 
                        source={require('./assets/icon.png')} 
                        style={styles.galleryWatermarkImage} 
                        resizeMode="contain" 
                      />
                    </View>
                  </View>
                )}
              />
              {currentPostImages.length > 1 && (
                <>
                  <TouchableOpacity 
                    style={[styles.navButtonLeft, { zIndex: 9999 }]} 
                    onPress={() => navigateImage('prev')}
                  >
                    <Ionicons name="chevron-back-circle" size={44} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.navButtonRight, { zIndex: 9999 }]} 
                    onPress={() => navigateImage('next')}
                  >
                    <Ionicons name="chevron-forward-circle" size={44} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </Modal>

          {/* Duplicate Post Modal */}
          <Modal visible={showDuplicateModal} transparent animationType="slide">
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>منشور موجود مسبقاً</Text>
                {duplicateModalPost && (
                  <View style={styles.duplicatePost}>
                    <Text style={styles.duplicateText}>
                      هذا المنشور موجود مسبقاً في قسم {duplicateModalPost.type === 'lost' ? 'المفقودة' : 'الموجودة'}:
                    </Text>
                    <Text style={styles.duplicateInfo}>النوع: {duplicateModalPost.title}</Text>
                    <Text style={styles.duplicateInfo}>الموديل: {duplicateModalPost.model}</Text>
                    <Text style={styles.duplicateInfo}>رقم الشاسى: {duplicateModalPost.vin}</Text>
                    {duplicateModalPost.phone && (
                      <Text style={styles.duplicateInfo}>الهاتف: {duplicateModalPost.phone}</Text>
                    )}
                  </View>
                )}
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={() => setShowDuplicateModal(false)}
                  >
                    <Text style={styles.modalButtonText}>إغلاق</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* 3. Add Post Modal (نظام الإضافة الجديد) */}
          <Modal visible={showAddModal} animationType="slide" transparent={false} onRequestClose={() => setShowAddModal(false)}>
            <SafeAreaView style={[styles.safeArea, { backgroundColor: '#FFF' }]}>
              <View style={styles.modalHeader}>
                <TouchableOpacity 
                  style={styles.modalHeaderClose} 
                  onPress={() => {
                    clearForm(); // Clear data when closing without adding
                    setShowAddModal(false);
                  }}
                >
                  <Ionicons name="close" size={28} color="#050505" />
                </TouchableOpacity>
                <Text style={styles.modalHeaderText}>إضافة منشور جديد</Text>
                <TouchableOpacity 
                  onPress={async () => {
                    await handleSubmit();
                  }} 
                  style={styles.modalHeaderSubmit}
                >
                  <Text style={styles.modalHeaderSubmitText}>نشر</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 100 }]}>
                <View style={styles.imageButtons}>
                  <TouchableOpacity style={styles.imageButton} onPress={takePhoto}>
                    <Ionicons name="camera" size={20} color="#FFF" />
                    <Text style={[styles.imageButtonText, { marginLeft: 8 }]}>الكاميرا</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
                    <Ionicons name="images" size={20} color="#FFF" />
                    <Text style={[styles.imageButtonText, { marginLeft: 8 }]}>المعرض</Text>
                  </TouchableOpacity>
                </View>

                {images && images.length > 0 && (
                  <ScrollView horizontal style={styles.imagesContainer} showsHorizontalScrollIndicator={false}>
                    {images.map((uri, idx) => (
                      <View key={`new-img-${idx}`} style={styles.imageWrapper}>
                        <TouchableOpacity onPress={() => openImageGallery(images, idx)}>
                          <Image source={{ uri }} style={styles.preview} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.removeBadge} onPress={() => removeImageAt(idx)}>
                          <Text style={styles.removeBadgeText}>✖</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                )}

                <View style={styles.modernInputWrapper}>
                  <Ionicons name="car-outline" size={20} color="#65676B" style={styles.modernInputIcon} />
                  <TextInput placeholder="نوع السيارة *" value={title} onChangeText={setTitle} style={styles.modernInput} placeholderTextColor="#999" />
                </View>

                <View style={styles.modernInputWrapper}>
                  <Ionicons name="calendar-outline" size={20} color="#65676B" style={styles.modernInputIcon} />
                  <TextInput placeholder="الموديل *" value={model} onChangeText={setModel} style={styles.modernInput} placeholderTextColor="#999" />
                </View>

                {tab !== 'sale' && tab !== 'rent' && (
                  <View style={styles.modernInputWrapper}>
                    <Ionicons name="barcode-outline" size={20} color="#65676B" style={styles.modernInputIcon} />
                    <TextInput placeholder="رقم الشاسى *" value={vin} onChangeText={setVin} style={styles.modernInput} placeholderTextColor="#999" />
                  </View>
                )}

                <View style={[styles.modernInputWrapper, { alignItems: 'flex-start', paddingTop: 10 }]}>
                  <Ionicons name="document-text-outline" size={20} color="#65676B" style={styles.modernInputIcon} />
                  <TextInput
                    placeholder={tab === 'sale' || tab === 'rent' ? 'المواصفات' : 'المواصفات *'}
                    value={description}
                    onChangeText={setDescription}
                    style={[styles.modernInput, { minHeight: 120 }]}
                    multiline
                    placeholderTextColor="#999"
                  />
                </View>

                {(tab === 'sale' || tab === 'rent') && (
                  <View style={styles.modernInputWrapper}>
                    <Ionicons name="cash-outline" size={20} color="#65676B" style={styles.modernInputIcon} />
                    <TextInput
                      placeholder={tab === 'sale' ? "السعر (جنيه سوداني) *" : "سعر الإيجار (جنيه سوداني) *"}
                      value={tab === 'sale' ? salePrice : rentPrice}
                      onChangeText={tab === 'sale' ? setSalePrice : setRentPrice}
                      keyboardType="numeric"
                      style={styles.modernInput}
                      placeholderTextColor="#999"
                    />
                  </View>
                )}

                {tab === 'rent' && (
                  <>
                    <View style={styles.modernInputWrapper}>
                      <Ionicons name="time-outline" size={20} color="#65676B" style={styles.modernInputIcon} />
                      <TextInput placeholder="مدة الإيجار *" value={rentalPeriod} onChangeText={setRentalPeriod} style={styles.modernInput} placeholderTextColor="#999" />
                    </View>

                    <View style={styles.pickerContainer}>
                      <Text style={styles.pickerLabel}>نوع العقد:</Text>
                      <View style={styles.pickerOptions}>
                        {['يومي', 'أسبوعي', 'شهري', 'سنوي'].map((type) => (
                          <TouchableOpacity
                            key={`contract-${type}`}
                            style={[styles.pickerOption, contractType === type && styles.pickerOptionSelected]}
                            onPress={() => setContractType(type)}>
                            <Text style={[styles.pickerOptionText, contractType === type && styles.pickerOptionTextSelected]}>{type}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <View style={styles.modernInputWrapper}>
                      <Ionicons name="shield-checkmark-outline" size={20} color="#65676B" style={styles.modernInputIcon} />
                      <TextInput placeholder="مبلغ التأمين" value={deposit} onChangeText={setDeposit} keyboardType="numeric" style={styles.modernInput} placeholderTextColor="#999" />
                    </View>
                  </>
                )}
                <View style={styles.modernInputWrapper}>
                  <Ionicons name="call-outline" size={20} color="#65676B" style={styles.modernInputIcon} />
                  <TextInput placeholder="رقم التواصل *" value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.modernInput} placeholderTextColor="#999" />
                </View>

                <TouchableOpacity style={styles.locationButton} onPress={getLocation}>
                  <Ionicons name="location-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.locationButtonText}>{location ? "تم تحديد الموقع" : "تحديد الموقع"}</Text>
                </TouchableOpacity>

                {location && (
                  <TouchableOpacity onPress={() => openMaps(location)} style={styles.locationStatus}>
                    <Text style={styles.locationStatusText}>الموقع محدد بنجاح • اضغط للمعالجة</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </SafeAreaView>
          </Modal>

          {/* 4. Floating Action Button (FAB) - Modern Pulsing Version */}
          <Animated.View 
            style={[
              styles.fabContainer,
              { transform: [{ scale: fabAnim }] }
            ]}
          >
            <TouchableOpacity 
              style={styles.fab} 
              activeOpacity={0.8}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
                setShowAddModal(true);
              }}
            >
              <View style={styles.fabIconBg}>
                <Ionicons name="add" size={24} color="#0070eb" />
              </View>
              <Text style={styles.fabText}>إضافة منشور</Text>
            </TouchableOpacity>
          </Animated.View>
          
          <BottomBannerAd />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// --- Optimized Skeleton Loader ---
const SkeletonCard = React.memo(() => {  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={styles.modernCard}>
      <Animated.View style={[styles.skeletonImage, { opacity }]} />
      <View style={styles.modernCardContent}>
        <Animated.View style={[styles.skeletonText, { width: '60%', opacity }]} />
        <Animated.View style={[styles.skeletonText, { width: '40%', opacity }]} />
        <Animated.View style={[styles.skeletonText, { width: '90%', height: 40, opacity, marginTop: 10 }]} />
      </View>
    </View>
  );
});

// Bottom Banner Ad Component
const BottomBannerAd = React.memo(() => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Set real Ad Unit ID for production, and use TestIds.BANNER for development
  const adUnitId = __DEV__ ? TestIds.BANNER : 'ca-app-pub-2559389808587750/7889359222';

  if (failed) return null;

  return (
    <View style={[styles.bottomAdContainer, !loaded && { height: 0, paddingVertical: 0, borderTopWidth: 0 }]}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={(error) => {
          console.log('Banner failed to load: ', error);
          setFailed(true);
        }}
      />
    </View>
  );
});

// AdCard Component (Placeholder for Google Ads)
const AdCard = React.memo(() => {
  return (
    <View style={styles.adCardContainer}>
      <View style={styles.adBadge}>
        <Text style={styles.adBadgeText}>إعلان ممول</Text>
      </View>
      <View style={styles.adPlaceholder}>
        <Ionicons name="megaphone-outline" size={40} color="#0866FF" style={{ opacity: 0.5 }} />
        <Text style={styles.adPlaceholderText}>هنا سيظهر إعلان Google AdMob</Text>
        <Text style={styles.adSubText}>سيتم تفعيل الإعلانات الحقيقية بعد التوثيق</Text>
      </View>
    </View>
  );
});

const PostCard = React.memo(({ item, myDeviceId, ownedPostIds, onToggleLike, fabAnim, onOpenGallery, onPhoneCall, onOpenMaps, onShare, onBump, onDelete }) => {
  const isOwner = (item.creatorDeviceId && myDeviceId === item.creatorDeviceId) || (ownedPostIds && ownedPostIds.has(item.id));
  const isLostOrFound = item.type === 'lost' || item.type === 'found';
  const isLiked = item.likedBy && item.likedBy.includes(myDeviceId);
  const likesCount = item.likedBy ? item.likedBy.length : 0;
  
  return (
    <View style={[styles.modernCard, isLostOrFound && styles.errorCardBorder]}>
      {/* Cover Image */}
      {item.images && item.images.length > 0 && (
        <View style={styles.modernCardImageContainer}>
          <TouchableOpacity onPress={() => onOpenGallery(item.images, 0)}>
            <Image source={{ uri: item.images[0] }} style={styles.modernCardCover} />
            <View style={styles.watermarkOverlay}>
              <Image source={require('./assets/icon.png')} style={styles.watermarkImage} resizeMode="contain" />
            </View>
          </TouchableOpacity>
          {item.images.length > 1 && (
            <View style={styles.imageCountBadge}>
              <Ionicons name="images" size={14} color="#FFF" />
              <Text style={styles.imageCountText}>{item.images.length}</Text>
            </View>
          )}
          <View style={styles.modernStatusBadgeFloat}>
            <View style={[styles.modernStatusBadge,
              item.type === 'lost' ? styles.modernLostBadge :
              item.type === 'found' ? styles.modernFoundBadge :
              item.type === 'sale' ? styles.modernSaleBadge : styles.modernRentBadge]}>
              <Text style={styles.modernStatusText}>
                {item.type === 'lost' ? 'بلاغ مفقود' :
                  item.type === 'found' ? 'معثور عليها' :
                  item.type === 'sale' ? 'للبيع' : 'للإيجار'}
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.modernCardContent}>
        <View style={styles.modernCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.modernCardTitle, isLostOrFound && styles.errorText]}>{item.title} {item.model}</Text>
            <View style={styles.modernUserInfoRow}>
              {isLostOrFound ? (
                <Ionicons name="location" size={14} color="#ba1a1a" />
              ) : (
                <Ionicons name="checkmark-circle" size={14} color="#0070eb" />
              )}
              <Text style={styles.modernUserInfoText}>{item.userName} • {new Date(item.createdAt).toLocaleDateString('ar-SA')}</Text>
            </View>
          </View>
        </View>

        {item.vin ? (
          <View style={[styles.vinContainer, isLostOrFound && styles.vinContainerError]}>
            <View style={styles.vinIconWrapper}>
              <Ionicons name="barcode-outline" size={20} color={isLostOrFound ? "#ba1a1a" : "#0070eb"} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.vinLabel}>رقم الشاسى</Text>
              <Text style={[styles.vinText, isLostOrFound && styles.errorText]}>{item.vin}</Text>
            </View>
          </View>
        ) : null}

        {!isLostOrFound && !!item.price && (
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceLabel}>السعر المطلوب</Text>
              <View style={styles.priceValueRow}>
                <Text style={styles.modernPriceText}>{item.price.replace(' جنيه سوداني', '')}</Text>
                <Text style={styles.modernCurrencyText}> ج.س</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.heartBtn} onPress={() => onToggleLike(item)}>
              <View style={{ alignItems: 'center' }}>
                <Ionicons 
                  name={isLiked ? "heart" : "heart-outline"} 
                  size={24} 
                  color={isLiked ? "#FF3B30" : "#75777e"} 
                />
                {likesCount > 0 && (
                  <Text style={{ fontSize: 10, color: isLiked ? "#FF3B30" : "#75777e", fontWeight: 'bold' }}>{likesCount}</Text>
                )}
              </View>
            </TouchableOpacity>
          </View>
        )}

        {!!item.description && (
          <Text style={styles.modernDescription}>{item.description}</Text>
        )}

        <View style={styles.actionsGrid}>
          {!!item.phone && (
            <Animated.View style={{ flex: 1, transform: [{ scale: isLostOrFound ? fabAnim : 1 }] }}>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => onPhoneCall(item.phone)}>
                <Ionicons name="call" size={20} color="#FFF" />
                <Text style={styles.primaryBtnText}>{isLostOrFound ? "اتصال" : "اتصل الآن"}</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => onShare(item)}>
            <Ionicons name="share-social" size={20} color="#101d26" />
            <Text style={styles.secondaryBtnText}>مشاركة</Text>
          </TouchableOpacity>
        </View>

        {isOwner && (
          <View style={styles.ownerActionsGrid}>
            <TouchableOpacity style={styles.ownerBtnBump} onPress={() => onBump(item.id, item.type, item.lastBumpedAt)}>
              <Ionicons name="rocket-outline" size={16} color="#0070eb" />
              <Text style={styles.ownerBtnTextBump}>تحديث</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ownerBtnDelete} onPress={() => {
              Alert.alert('تأكيد الحذف', 'هل أنت متأكد من أنك تريد حذف هذا المنشور؟', [
                { text: 'إلغاء', style: 'cancel' },
                { text: 'حذف', onPress: () => onDelete(item.id, item.type), style: 'destructive' },
              ]);
            }}>
              <Ionicons name="trash-outline" size={16} color="#ba1a1a" />
              <Text style={styles.ownerBtnTextDelete}>حذف</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
});


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6faff',
    paddingBottom: Platform.OS === 'android' ? 45 : 0, 
  },
  container: {
    padding: 16,
    paddingBottom: 150, // Increased to account for sticky ads and floating buttons
  },
  headerContainer: {
    marginBottom: 20,
    paddingTop: 20, // Move down slightly more as requested
  },
  headerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0866FF',
    textAlign: 'center',
    flex: 1,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(8, 102, 255, 0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  headerLine: {
    height: 2,
    backgroundColor: '#0866FF',
    marginTop: 8,
    borderRadius: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2C3E50',
    borderRadius: 8,
    padding: 12,
    color: '#E0E0E0',
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#1E3A8A',
    padding: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  searchButtonText: {
    color: '#E0E0E0',
    fontSize: 16,
  },
  clearSearchButton: {
    backgroundColor: '#666',
    padding: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  clearSearchButtonText: {
    color: '#E0E0E0',
    fontSize: 16,
  },
  // --- Swipe Tab Styles ---
  swipeTabWrapper: {
    marginBottom: 20,
    alignItems: 'center',
  },
  swipeTabScrollView: {
    width: '100%',
  },
  swipeTabItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernTabsWrapper: {
    marginBottom: 16,
  },
  modernTabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  modernTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    marginHorizontal: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeModernTab: {
    backgroundColor: '#0070eb',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#0070eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernTabText: {
    color: '#44474d',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  activeModernTabText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  dotsContainer: {
    flexDirection: 'row',
    marginTop: 12,
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#0866FF',
    width: 24,
  },
  inactiveDot: {
    backgroundColor: '#CED0D4',
  },
  modernTabText: {
    color: '#65676B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  activeModernTabText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  // --- Watermark Styles ---
  modernCardImageContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  watermarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    padding: 10,
    pointerEvents: 'none',
  },
  watermarkImage: {
    width: 60,
    height: 60,
    opacity: 0.25,
    borderRadius: 30,
    overflow: 'hidden',
  },
  galleryWatermark: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    padding: 20,
    pointerEvents: 'none',
  },
  galleryWatermarkImage: {
    width: 100,
    height: 100,
    opacity: 0.2,
    borderRadius: 50,
    overflow: 'hidden',
  },
  imageButtons: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  headerIconBtn: {
    padding: 8,
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  filterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  filterBtnText: {
    fontSize: 12,
    color: '#0866FF',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  notifDropdown: {
    position: 'absolute',
    top: 60, // Adjusted for fixed header
    right: 20,
    left: 20,
    backgroundColor: '#FFF',
    borderRadius: 15,
    padding: 16,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    zIndex: 999,
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  notifTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#050505',
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  notifText: {
    fontSize: 14,
    color: '#65676B',
    marginLeft: 12,
    flex: 1,
  },
  sortMenu: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: '#FFF',
    borderRadius: 15,
    padding: 8,
    width: 160,
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    zIndex: 1000,
  },
  sortMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  sortMenuText: {
    fontSize: 14,
    color: '#65676B',
    marginLeft: 10,
    fontWeight: '500',
  },
  activeSortText: {
    color: '#0866FF',
    fontWeight: 'bold',
  },
  imageButton: {
    flex: 1,
    backgroundColor: '#1E3A8A',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  imageButtonText: {
    color: '#E0E0E0',
    fontSize: 16,
  },
  imagesContainer: {
    marginBottom: 16,
  },
  imageWrapper: {
    position: 'relative',
    marginRight: 8,
  },
  preview: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E3A8A',
  },
  removeBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF4444',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CED0D4',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    color: '#050505',
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    marginBottom: 12,
  },
  pickerLabel: {
    color: '#E0E0E0',
    fontSize: 16,
    marginBottom: 8,
  },
  pickerOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pickerOption: {
    backgroundColor: '#112244',
    borderWidth: 1,
    borderColor: '#2C3E50',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  pickerOptionSelected: {
    backgroundColor: '#0866FF',
    borderColor: '#0866FF',
  },
  pickerOptionText: {
    color: '#E0E0E0',
    fontSize: 14,
  },
  pickerOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  locationButton: {
    backgroundColor: '#0866FF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  locationButtonText: {
    color: '#E0E0E0',
    fontSize: 16,
  },
  locationStatus: {
    backgroundColor: '#112244',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E3A8A',
    marginBottom: 12,
  },
  locationStatusText: {
    color: '#B0B0B0',
    fontSize: 14,
    textAlign: 'center',
  },
  addBtn: {
    backgroundColor: '#0866FF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionTitleContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(8, 102, 255, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(8, 102, 255, 0.15)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0866FF',
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: '#112244',
    borderWidth: 1,
    borderColor: '#1E3A8A',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E0E0E0',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  lostBadge: {
    backgroundColor: '#FF6B6B',
  },
  foundBadge: {
    backgroundColor: '#4ECDC4',
  },
  saleBadge: {
    backgroundColor: '#45B7D1',
  },
  rentBadge: {
    backgroundColor: '#96CEB4',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  userInfo: {
    color: '#B0B0B0',
    fontSize: 14,
    marginBottom: 4,
  },
  meta: {
    color: '#B0B0B0',
    fontSize: 14,
    marginBottom: 4,
  },
  phoneLink: {
    fontSize: 15,
    marginBottom: 8,
    color: '#4ECDC4',
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
  price: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  rentInfo: {
    marginBottom: 8,
  },
  postImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#1E3A8A',
  },
  locationBtn: {
    backgroundColor: '#1E3A8A',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginVertical: 8,
  },
  locationText: {
    color: '#E0E0E0',
    fontSize: 14,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  shareButton: {
    backgroundColor: '#3E4042',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  deleteButton: {
    backgroundColor: '#FF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  timestamp: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
    flexBasis: '100%',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalImage: {
    width: screenWidth * 0.9,
    height: screenHeight * 0.7,
    borderRadius: 8,
  },
  navButtonLeft: {
    position: 'absolute',
    left: 20,
    top: '50%',
    transform: [{ translateY: -20 }],
  },
  navButtonRight: {
    position: 'absolute',
    right: 20,
    top: '50%',
    transform: [{ translateY: -20 }],
  },
  imageCounter: {
    position: 'absolute',
    bottom: 40,
    color: '#FFFFFF',
    fontSize: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    borderWidth: 1,
    borderColor: '#1E3A8A',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E0E0E0',
    marginBottom: 16,
    textAlign: 'center',
  },
  duplicatePost: {
    marginBottom: 16,
  },
  duplicateText: {
    color: '#E0E0E0',
    fontSize: 16,
    marginBottom: 8,
  },
  duplicateInfo: {
    color: '#B0B0B0',
    fontSize: 14,
    marginBottom: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  modalButton: {
    backgroundColor: '#0866FF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // --- Modern Search Bar Styles ---
  modernSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  modernSearchIcon: {
    marginRight: 8,
  },
  actionsWrapContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  smallActionBtn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    minWidth: 60,
  },
  smallActionLabel: {
    fontSize: 10,
    color: '#444',
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  actionBtnLabelGridMD: {
    fontSize: 11,
    color: '#0866FF',
    fontWeight: '700',
    marginLeft: 4,
  },
  actionBtnLabelGridDeleteMD: {
    fontSize: 11,
    color: '#FF3B30',
    fontWeight: '700',
    marginLeft: 4,
  },
  secondaryActionsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  modernActionBtnGridBump: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF2FF',
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#D0E1FF',
  },
  modernActionBtnGridDelete: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0F0',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFD9D9',
  },
  actionBtnLabelGrid: {
    fontSize: 12,
    color: '#0866FF',
    fontWeight: '700',
    marginLeft: 8,
  },
  actionBtnLabelGridDelete: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '700',
    marginLeft: 8,
  },
  modernSearchInput: {
    flex: 1,
    color: '#050505',
    fontSize: 12, // Reduced to ensure it fits perfectly
    textAlign: 'right',
  },
  modernClearSearchBtn: {
    paddingLeft: 8,
  },
  modernCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 88, 188, 0.05)',
    shadowColor: '#0058bc',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  modernCardCover: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  imageCountBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  imageCountText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  modernCardContent: {
    padding: 16,
  },
  modernCardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modernCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#101d26',
    marginBottom: 4,
    textAlign: 'right',
  },
  modernStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  modernLostBadge: { backgroundColor: '#ba1a1a' },
  modernFoundBadge: { backgroundColor: '#34C759' },
  modernSaleBadge: { backgroundColor: '#0070eb' },
  modernRentBadge: { backgroundColor: '#FF9500' },
  modernStatusText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', color: '#FFF' },
  modernLostText: { color: '#FFF' },
  modernFoundText: { color: '#FFF' },
  modernSaleText: { color: '#FFF' },
  modernRentText: { color: '#FFF' },
  modernUserInfoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 8,
  },
  modernUserInfoText: {
    color: '#75777e',
    fontSize: 12,
    marginRight: 4,
    fontWeight: '500',
    textAlign: 'right',
  },
  modernDot: {
    color: '#8899A6',
    marginHorizontal: 6,
  },
  modernTimeText: {
    color: '#666',
    fontSize: 12,
    marginRight: 4,
    textAlign: 'right',
  },
  modernPriceText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0070eb',
  },
  modernSubPriceText: {
    fontSize: 14,
    color: '#65676B',
    fontWeight: 'normal',
  },
  modernDivider: {
    height: 1,
    backgroundColor: '#CED0D4',
    marginBottom: 12,
    opacity: 0.5,
  },
  modernMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  modernMetaText: {
    color: '#65676B',
    fontSize: 14,
    marginRight: 6,
    textAlign: 'right',
  },
  modernRentDetails: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modernDescription: {
    color: '#44474d',
    fontSize: 15,
    lineHeight: 24,
    marginTop: 8,
    marginBottom: 20,
    textAlign: 'right',
  },
  modernActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modernActionBtnPrimary: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#0866FF',
    paddingVertical: 13,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    elevation: 6,
    shadowColor: '#0866FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  modernActionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F0F2F5',
    paddingVertical: 13,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E4E6EB',
  },
  modernActionBtnTextPrimary: {
    color: '#FFF',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 15,
  },
  modernActionBtnTextSecondary: {
    color: '#007AFF',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 15,
  },
  modernActionBtnIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  modernActionBtnIconBump: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF2FF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#D0E1FF',
    elevation: 2,
    shadowColor: '#0866FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  modernActionBtnIconDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F0',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFD9D9',
    elevation: 2,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionBtnLabel: {
    fontSize: 12,
    color: '#0866FF',
    fontWeight: '700',
    marginLeft: 8,
  },
  actionBtnLabelBump: {
    fontSize: 12,
    color: '#0866FF',
    fontWeight: '800',
    marginLeft: 8,
  },
  actionBtnLabelDelete: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '800',
    marginLeft: 8,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 100,
    left: 24, // Shifted to left to match the Stitch design bottom-left FAB
    elevation: 10,
    zIndex: 999,
  },
  fab: {
    backgroundColor: '#0070eb',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 24,
    paddingVertical: 16,
    borderRadius: 40,
    shadowColor: '#0070eb',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  fabIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  fabText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  // --- New Card Layout Styles ---
  errorCardBorder: {
    borderColor: 'rgba(186,26,26,0.3)',
    borderWidth: 1,
  },
  modernStatusBadgeFloat: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  errorText: {
    color: '#ba1a1a',
  },
  vinContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#f0f7ff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#d0e1ff',
  },
  vinContainerError: {
    backgroundColor: '#ffdad6',
    borderColor: 'rgba(186,26,26,0.2)',
  },
  vinIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  vinLabel: {
    fontSize: 11,
    color: '#44474d',
    fontWeight: 'bold',
    textAlign: 'right',
  },
  vinText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#101d26',
    letterSpacing: 2,
    textAlign: 'right',
  },
  priceRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  priceLabel: {
    fontSize: 11,
    color: '#44474d',
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'right',
  },
  priceValueRow: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
  },
  modernCurrencyText: {
    fontSize: 12,
    color: '#44474d',
    fontWeight: 'bold',
  },
  heartBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#c5c6cd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewardText: {
    fontSize: 14,
    color: '#93000a',
    fontWeight: 'bold',
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row-reverse',
    gap: 12,
    justifyContent: 'space-between',
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    backgroundColor: '#0070eb',
    paddingVertical: 16,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0070eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  primaryBtnError: {
    backgroundColor: '#ba1a1a',
    shadowColor: '#ba1a1a',
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 8,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#c5c6cd',
    paddingVertical: 14,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#101d26',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 8,
  },
  ownerActionsGrid: {
    flexDirection: 'row-reverse',
    gap: 12,
    marginTop: 12,
  },
  ownerBtnBump: {
    flex: 1,
    flexDirection: 'row-reverse',
    backgroundColor: '#e5f2ff',
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerBtnTextBump: {
    color: '#0070eb',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 8,
  },
  ownerBtnDelete: {
    flex: 1,
    flexDirection: 'row-reverse',
    backgroundColor: '#ffdad6',
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerBtnTextDelete: {
    color: '#ba1a1a',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 8,
  },
  // --- Skeleton Styles ---
  skeletonImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#E4E6EB',
  },
  skeletonText: {
    backgroundColor: '#E4E6EB',
    height: 16,
    borderRadius: 4,
    marginBottom: 8,
  },
  // --- Modern Input Improvements ---
  modernInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CED0D4',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  modernInputIcon: {
    marginRight: 10,
  },
  modernInput: {
    flex: 1,
    paddingVertical: 12,
    color: '#050505',
    fontSize: 16,
    textAlign: 'right',
  },
  // --- New Modal Header Styles ---
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#CED0D4',
    backgroundColor: '#FFF',
  },
  modalHeaderClose: {
    padding: 4,
  },
  modalHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#050505',
  },
  modalHeaderSubmit: {
    backgroundColor: '#0866FF',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 18,
  },
  modalHeaderSubmitText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  adCardContainer: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E4E6EB',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  adBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#F0F2F5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  adBadgeText: {
    fontSize: 10,
    color: '#65676B',
    fontWeight: 'bold',
  },
  adPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  adPlaceholderText: {
    fontSize: 16,
    color: '#050505',
    fontWeight: 'bold',
    marginTop: 10,
    textAlign: 'center',
  },
  adSubText: {
    fontSize: 12,
    color: '#65676B',
    marginTop: 4,
    textAlign: 'center',
  },
  bottomAdContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E4E6EB',
    paddingVertical: 10,
    paddingHorizontal: 16,
    height: 70,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 20,
    zIndex: 1000,
  },
  bottomAdLabel: {
    fontSize: 8,
    color: '#65676B',
    position: 'absolute',
    top: 4,
    right: 8,
    fontWeight: 'bold',
  },
  bottomAdPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomAdText: {
    fontSize: 14,
    color: '#050505',
    marginLeft: 8,
    fontWeight: '500',
  },
});