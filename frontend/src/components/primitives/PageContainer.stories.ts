import type { Meta, StoryObj } from '@storybook/vue3';
import PageContainer from './PageContainer.vue';

const meta: Meta<typeof PageContainer> = {
  title: 'Primitives/PageContainer',
  component: PageContainer,
  tags: ['autodocs'],
  argTypes: {
    tag: {
      control: 'text',
    },
  },
  args: {
    tag: 'div',
  },
};

export default meta;
type Story = StoryObj<typeof PageContainer>;

export const Default: Story = {
  render: (args) => ({
    components: { PageContainer },
    setup() {
      return { args };
    },
    template: `
      <PageContainer v-bind="args">
        <h1>Seitenüberschrift</h1>
        <p>Inhalt mit maximaler Seitenbreite von 960px und responsivem Padding.</p>
      </PageContainer>
    `,
  }),
};
