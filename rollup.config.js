import terser from '@rollup/plugin-terser';

export default {
  input: 'src/a-code.js',
  output: {
    file: 'dist/a-code.min.js',
    format: 'es',
    sourcemap: false,
  },
  plugins: [
    terser({
      output: {
        comments: false
      },
      compress: {
        keep_infinity: true,
        reduce_funcs: true,
        join_vars: true,
        keep_fnames: false
      },
        mangle: true
    }),
  ],
};
