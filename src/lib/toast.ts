/**
 * Toast notification utility.
 * Displays a transient message at the bottom of the screen.
 */

export function showToast(message: string, duration = 3000): void {
  let toast = document.querySelector<HTMLElement>('.atlas-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'atlas-toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add('visible');

  // Clear any pending hide timer
  const existing = (toast as any).__toastTimer as ReturnType<typeof setTimeout> | undefined;
  if (existing) clearTimeout(existing);

  (toast as any).__toastTimer = setTimeout(() => {
    toast!.classList.remove('visible');
  }, duration);
}
