/**
 * Firebase yapılandırması (Guvercin Beta projesi).
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyDdLrtoZo7I1H_vJlFrW5KLLE6C10RamcU',
  authDomain: 'guvercin-beta-dev.firebaseapp.com',
  projectId: 'guvercin-beta-dev',
  storageBucket: 'guvercin-beta-dev.firebasestorage.app',
  messagingSenderId: '633405170493',
  appId: '1:633405170493:web:e73c6a293bcd057f551b54'
}

export const isConfigured = () =>
  !!firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== 'BURAYA-YAPIŞTIR' &&
  !!firebaseConfig.projectId &&
  firebaseConfig.projectId !== 'PROJE-ADI'