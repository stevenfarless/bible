// ====================
// Authentication Management
// ====================

export class AuthManager {
  constructor(auth, database) {
    this.auth = auth;
    this.database = database;
  }

  async handleLogin(email, password) {
    try {
      await this.auth.signInWithEmailAndPassword(email, password);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async handleSignup(email, password) {
    try {
      await this.auth.createUserWithEmailAndPassword(email, password);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async handleLogout() {
    try {
      await this.auth.signOut();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async loadUserData(user) {
    if (!user || !this.database) return null;

    try {
      const snapshot = await this.database.ref(`users/${user.uid}`).once("value");
      return snapshot.val();
    } catch (error) {
      console.error("Error loading user data:", error);
      return null;
    }
  }

  async saveUserApiKey(userId, apiKeyPlaintext) {
    if (!userId || !this.database) return;

    const encoded = window.apiKeyCodec?.encode
      ? window.apiKeyCodec.encode(apiKeyPlaintext)
      : apiKeyPlaintext;

    await this.database.ref(`users/${userId}/apiKey`).set(encoded);
  }

  async loadUserApiKey(userId) {
    if (!userId || !this.database) return "";

    const snap = await this.database.ref(`users/${userId}/apiKey`).once("value");
    const encoded = snap.val();
    if (!encoded) return "";

    return window.apiKeyCodec?.decode ? window.apiKeyCodec.decode(encoded) : encoded;
  }

  async saveReadingPosition(userId, book, chapter, scrollPosition) {
    if (!userId || !this.database) return;

    try {
      await this.database.ref(`users/${userId}/readingPosition`).set({
        book,
        chapter,
        scrollPosition,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Error saving reading position:", error);
    }
  }

  async loadReadingPosition(userId) {
    if (!userId || !this.database) return null;

    try {
      const snapshot = await this.database.ref(`users/${userId}/readingPosition`).once("value");
      return snapshot.val();
    } catch (error) {
      console.error("Error loading reading position:", error);
      return null;
    }
  }

  updateUserButton(user, userBtn, userEmail) {
    if (!userBtn) return;

    if (user) {
      userBtn.classList.add("logged-in");
      if (userEmail) userEmail.textContent = user.email || "";
    } else {
      userBtn.classList.remove("logged-in");
      if (userEmail) userEmail.textContent = "";
    }
  }
}
