# How to Generate the APK

## Prerequisites
1.  **Node.js** installed.
2.  **Android Studio** installed (this is required to compile the APK).

## Steps

### 1. Install Dependencies
Run this command in your VS Code terminal:
```bash
npm install
```

### 2. Build the Android Project
This compiles your React code and creates the Android native project folder:
```bash
npm run android:build
```

### 3. Open in Android Studio
This will launch Android Studio with your project loaded:
```bash
npm run android:open
```

### 4. Build the APK
Inside Android Studio:
1.  Wait for Gradle sync to finish.
2.  Go to the top menu: **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
3.  Once finished, a popup will appear at the bottom right. Click **locate** to find your `.apk` file.

## Troubleshooting
*   **Geolocation Permission**: If the app crashes when using location, ensure you add the permission to `android/app/src/main/AndroidManifest.xml`:
    ```xml
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    ```
