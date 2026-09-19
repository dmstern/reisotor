import type { Meta, StoryObj } from '@storybook/vue3';
import DiaryFontSettings from './DiaryFontSettings.vue';

const meta: Meta<typeof DiaryFontSettings> = {
  title: 'Components/DiaryFontSettings',
  component: DiaryFontSettings,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DiaryFontSettings>;

export const Default: Story = {
  render: () => ({
    components: { DiaryFontSettings },
    template: `
      <div style="max-width: 600px; padding: 20px;">
        <DiaryFontSettings />
      </div>
    `,
  }),
};
