/**
 * Formats Firebase Auth errors into clear, user-friendly messages.
 * Ensures raw Firebase exception messages are never displayed directly.
 *
 * @param {Error|Object} error - Error thrown by Firebase Auth
 * @returns {string} Human-friendly error description
 */
export function formatAuthError(error) {
  if (!error) return 'An unexpected error occurred. Please try again.';

  const code = error.code || '';

  switch (code) {
    case 'auth/invalid-email':
      return 'The email address is invalid. Please enter a valid email address.';
    case 'auth/user-not-found':
      return 'No account found with this email address. Please check your email or register.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please verify and try again.';
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please verify your credentials and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Please sign in instead.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled. Please enable it in Firebase Console.';
    case 'auth/too-many-requests':
      return 'Access temporarily blocked due to too many failed attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network communication failed. Please check your internet connection.';
    case 'auth/user-disabled':
      return 'This user account has been disabled by an administrator.';
    case 'auth/requires-recent-login':
      return 'Please sign out and sign in again before performing this action.';
    default:
      // Strip any internal Firebase prefixes if present
      if (typeof error.message === 'string' && error.message.includes('Firebase:')) {
        return 'An error occurred during authentication. Please check your credentials and try again.';
      }
      return error.message || 'An error occurred during authentication. Please try again.';
  }
}
