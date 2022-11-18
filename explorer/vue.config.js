module.exports = {
  publicPath: "/toml-eslint-parser/",
  transpileDependencies: [/site-kit-monaco-editor-vue/],
  chainWebpack(config) {
    config.resolve.extensions.prepend(".ts");

    config.module
      .rule("ts")
      .test(/\.ts$/)
      .use("babel-loader")
      .loader("babel-loader");
  },
};
