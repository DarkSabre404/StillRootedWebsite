# Asvattha (Still Rooted) 🌱

An interactive, multi-page web application built as a community school project to bridge generations, connect seniors and youth, and foster community through storytelling, shared knowledge, and active engagement.

---

## Project Overview

**Asvattha** is a fully responsive community platform designed to facilitate intergenerational bonding. It combines modern web technologies (HTML5, CSS3, ES6+ JavaScript) with Firebase Authentication and Cloud Firestore to offer secure user accounts, dynamic media updates, admin-managed community features, and a built-in virtual assistant.

---

## Key Features & Technical Highlights

### 1. Secure Authentication & Role-Based Access Control (RBAC)
- **Firebase Auth Integration:** Secure user sign-up, login, password reset handling, and session persistence.
- **Password Reset Privacy:** The reset flow returns the same message whether Firebase accepts or rejects a request. Enable Firebase Authentication's **Email enumeration protection** in the Firebase Console as well; client-side messaging alone cannot prevent direct API enumeration.
- **Safe Role Assignment:** Public sign-up is limited to participant, volunteer/mentor, and student/researcher roles. Admin status is never selectable by a visitor and cannot be changed by a non-admin account.
- **Firebase Rules:** `firestore.rules` restricts content management, submissions access, profile changes, and media reads/writes. These server-side rules are authoritative; hiding browser controls is not security.
- **Admin Provisioning:** After an account is created, grant the first administrator by setting that user's `users/{uid}.role` to `admin` in the Firebase Console. Only an existing admin may grant or revoke admin roles afterward.
- **Dynamic Privileges:** The user profile page dynamically loads role-specific privileges, badges, and exclusive dashboard views.
- **Smart Navbar Profile Badge:** Generates custom profile pictures or color-coded user initial avatars with local storage caching for zero-latency rendering on page load.

### 2. Interactive Profile & Account Management Dashboard
- **Custom Bio & Avatar Settings:** Members can update their display name, bio, profile color theme, and avatar image with client-side cropping and image compression into data URLs.
- **Security Settings:** In-app password change, login history tracking, active session management, and logout-all-devices capability.
- **Data Privacy Controls:** Allows users to download a complete JSON export of their profile and login history, deactivate their account, or permanently delete their account with cryptographic re-authentication.
- **Privacy Notice:** The signed-in profile menu explains account data, form handling, public content, and how to contact the team with data requests.

### 3. Interactive Ledger Grid Calendar & Events Management
- **Almanac-Style Calendar Grid:** An interactive monthly calendar featuring clean grid layouts, previous/next month navigation, and visual event indicators.
- **Admin Event Management:** Administrators can add, edit, or delete community events in real-time with instant Firestore synchronization.
- **Calendar Exports:** Visitors can add an event to Google Calendar or download an iCalendar file. Event times are interpreted in Asia/Kolkata and written as UTC in `.ics` files for compatibility.

### 4. AshBot Virtual Assistant (`chatbot.js`)
- **Static Rule-Based Backup:** A dependency-free assistant built into the browser; it remains available when the model endpoint is unavailable.
- **Advanced Language Engine:** Features text normalization, singular/plural stemming, conservative spelling correction, quick-reply suggestion chips, and conversation memory persistence.
- **Optional Groq Responses:** On Cloudflare Pages, `/api/secure-action` reads the `StillRootedChatbotKey` or `GROQ_API_KEY` secret and proxies requests to Groq. If the key, service, or free-tier quota is unavailable, AshBot falls back to its built-in rule-based answers.

### 5. Dynamic Content Management (Admin Controls)
- **About Us Team Manager:** Alternating zig-zag layout for team cards with admin controls to dynamically add or delete team members.
- **Community Gallery & Blog:** Admins can preview blog posts before publishing. New images are resized and compressed into responsive variants stored in Firestore; deleted posts/photos are recoverable from the admin-only archive.
- **Firestore Media:** Image variants are separate `mediaImages` documents, capped at 850 KB each to stay below Firestore's document-size limit. Public reads are allowed only while a published blog or gallery document references the variant; uploads and listing are admin-only. Each image and its post/photo are written atomically. This uses Firestore reads and storage instead of Firebase Storage; deploy authorization with `firebase deploy --only firestore:rules`. No Storage bucket or Storage Rules are required.
- **Get Involved Submissions:** Review dashboard allowing administrators to filter, review, and delete form submissions for volunteers, senior mentors, and partner organizations.

### 6. Interactive Forms & Contact Integration
- **EmailJS Integration:** Fully configured contact form enabling users to send inquiries directly to the project team with automated success and/or error status feedback.
- **Responsive Navigation:** Mobile-optimized drop-down navigation bar with smooth toggle animations and preserved Google Translate language preferences.

---

## Tech Stack
- **Frontend:** HTML5, CSS3 (Custom variables, Flexbox, responsive design), JavaScript (ES6+).
- **Backend & Database:** Firebase Authentication and Cloud Firestore.
- **Third-Party Services:** EmailJS (for contact form email dispatch).

---

## Project Structure
```text
StillRootedWebsite/
├── css/
│   ├── foundation.css
│   ├── navigation.css
│   ├── components.css
│   ├── chatbot.css
│   ├── accessibility.css
│   ├── events.css
│   ├── motion.css
│   ├── refinements.css
│   └── pages.css
├── forms/
│   ├── mentor.html
│   ├── partner.html
│   └── volunteer.html
├── functions/
│   └── api/
│       └── secure-action.js
├── .github/
│   └── workflows/
│       └── site-checks.yml
├── scripts/
│   └── check_site.py
├── images/
│   ├── apple-touch-icon.png
│   ├── favicon.svg
│   └── og-image.jpg
├── js/
│   ├── admin-content.js
│   ├── chatbot.js
│   ├── events.js
│   ├── firebase-config.js
│   ├── form-submissions.js
│   ├── media-uploads.js
│   └── main.js
├── resources/
├── .assetsignore
├── firebase.json
├── firestore.rules
├── robots.txt
├── sitemap.xml
├── 404.html
├── about.html
├── auth.html
├── blog.html
├── calendar.html
├── contact.html
├── gallery.html
├── get-involved.html
├── index.html
├── model.html
├── programs.html
├── README.md
└── research.html
```
