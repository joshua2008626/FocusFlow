/** Preflight is off so the existing design-token CSS (src/styles.css) keeps working; utilities are available for new UI. */
export default { content: ['./index.html', './src/**/*.{ts,tsx}'], corePlugins: { preflight: false }, theme: { extend: { colors: { ac: '#7c5cff', ac2: '#22d3ee' } } } };
