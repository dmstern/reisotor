import type { Meta, StoryObj } from '@storybook/vue3';
import UploadProgressBar from './UploadProgressBar.vue';

const meta: Meta<typeof UploadProgressBar> = {
  title: 'Components/UploadProgressBar',
  component: UploadProgressBar,
  tags: ['autodocs'],
  argTypes: {
    current: { control: 'number' },
    total: { control: 'number' },
    progressPercent: { control: 'number' },
    filename: { control: 'text' },
    cancellable: { control: 'boolean' },
    error: { control: 'text' },
  },
  args: {
    current: 1,
    total: 3,
    progressPercent: 33,
    filename: 'Flugticket.pdf',
    cancellable: true,
  },
};

export default meta;
type Story = StoryObj<typeof UploadProgressBar>;

export const Default: Story = {
  render: (args) => ({
    components: { UploadProgressBar },
    setup() {
      return { args };
    },
    template: `
      <div style="max-width: 480px; padding: 20px;">
        <UploadProgressBar v-bind="args" @cancel="() => console.log('Upload cancelled')" />
      </div>
    `,
  }),
};

export const SingleFile: Story = {
  args: {
    current: 1,
    total: 1,
    progressPercent: 65,
    filename: 'Hotelbuchung.pdf',
  },
  render: (args) => ({
    components: { UploadProgressBar },
    setup() {
      return { args };
    },
    template: `
      <div style="max-width: 480px; padding: 20px;">
        <UploadProgressBar v-bind="args" @cancel="() => console.log('Upload cancelled')" />
      </div>
    `,
  }),
};

export const MultipleFiles: Story = {
  args: {
    current: 3,
    total: 5,
    progressPercent: 60,
    filename: 'Strandpromenade-Sonnenuntergang.jpg',
  },
  render: (args) => ({
    components: { UploadProgressBar },
    setup() {
      return { args };
    },
    template: `
      <div style="max-width: 480px; padding: 20px;">
        <UploadProgressBar v-bind="args" @cancel="() => console.log('Upload cancelled')" />
      </div>
    `,
  }),
};

export const AlmostDone: Story = {
  args: {
    current: 4,
    total: 4,
    progressPercent: 95,
    filename: 'Reisekosten-Beleg.pdf',
  },
  render: (args) => ({
    components: { UploadProgressBar },
    setup() {
      return { args };
    },
    template: `
      <div style="max-width: 480px; padding: 20px;">
        <UploadProgressBar v-bind="args" @cancel="() => console.log('Upload cancelled')" />
      </div>
    `,
  }),
};

export const WithError: Story = {
  args: {
    current: 2,
    total: 4,
    progressPercent: 40,
    filename: 'BeschaedigteDatei.jpg',
    error: 'Upload fehlgeschlagen. Bitte Verbindung prüfen.',
  },
  render: (args) => ({
    components: { UploadProgressBar },
    setup() {
      return { args };
    },
    template: `
      <div style="max-width: 480px; padding: 20px;">
        <UploadProgressBar v-bind="args" @cancel="() => console.log('Upload cancelled')" />
      </div>
    `,
  }),
};

export const NonCancellable: Story = {
  args: {
    current: 1,
    total: 2,
    progressPercent: 50,
    filename: 'Hintergrund-Synchronisation.dat',
    cancellable: false,
  },
  render: (args) => ({
    components: { UploadProgressBar },
    setup() {
      return { args };
    },
    template: `
      <div style="max-width: 480px; padding: 20px;">
        <UploadProgressBar v-bind="args" />
      </div>
    `,
  }),
};
