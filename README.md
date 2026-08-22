## LoveBridge 

A production-ready, full-stack application designed to keep couples connected through real-time communication, synchronized media sharing, and collaborative planning. 

### 🚀 Features & Tech Stack

This project leverages a modern web development stack to deliver real-time features:

*   **Real-Time Messaging & Media:** Instant chat and a synchronized music room powered by WebRTC and Firebase.
*   **Collaborative Planning:** Shared calendar, expense tracking (`Finance.jsx`), and memory storage (`Scrapbook.jsx`).
*   **Resilient UX:** Built-in offline detection and progressive web app (PWA) capabilities.
*   **Frontend Ecosystem:** React.js powered by Vite, styled with Tailwind CSS.
*   **Backend & Hosting:** Firebase Authentication and Firestore, with serverless functions deployed via Vercel (`vercel.json`).

### 📂 Project Structure

The codebase is organized into a scalable modular architecture:

*   `api/` - Contains serverless backend functions like `chat.js`.
*   `src/pages/` - Core application views, including the Dashboard, Messages, Music Room, and Games.
*   `src/hooks/` - Custom utility hooks tailored to the app, such as `useCouple.js` and `useWeather.js`.
*   `src/firebase/` - Centralized configuration (`config.js`) and authentication (`auth.js`).
*   `src/context/` - Global state management, primarily handled through `AuthContext.jsx`.
*   `src/components/shared/` - Reusable interface components like `ErrorBoundary.jsx` and `OfflineDetector.jsx`.

### 💻 Getting Started

Follow these steps to run the development server locally:

1.  Navigate into the project root directory.
2.  Install all necessary dependencies by running `npm install`.
3.  Configure your environment by adding your Firebase credentials to a local environment file.
4.  Start the Vite development server by executing `npm run dev`.
