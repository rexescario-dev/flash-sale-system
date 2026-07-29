/** @returns {import('vite').Plugin} */
export default function tailwindcss() {
  return {
    name: 'tailwindcss-local-bridge',
    // Real @tailwindcss/vite processes utilities; this bridge uses static CSS from `tailwindcss` package.
  };
}
