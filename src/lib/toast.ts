/**
 * Toast notification utility.
 * Displays a transient message at the bottom of the screen.
 */

export function showToast(message: string, type: 'info' | 'success' | 'error' = 'info', duration = 3500): void {
  let toast = document.querySelector<HTMLElement>('.atlas-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'atlas-toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.dataset['type'] = type;
  toast.classList.add('visible');

  const existing = (toast as HTMLElement & { __toastTimer?: ReturnType<typeof setTimeout> }).__toastTimer;
  if (existing) clearTimeout(existing);

  (toast as HTMLElement & { __toastTimer?: ReturnType<typeof setTimeout> }).__toastTimer = setTimeout(() => {
    toast!.classList.remove('visible');
  }, duration);
}
