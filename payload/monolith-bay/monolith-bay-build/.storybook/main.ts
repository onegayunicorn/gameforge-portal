import type { StorybookConfig } from "@storybook/html-vite";
const config: StorybookConfig = {
  stories: ["../packages/ui-components/src/**/*.stories.@(ts|mdx)"],
  addons: ["@storybook/addon-essentials"],
  framework: { name: "@storybook/html-vite", options: {} },
};
export default config;
