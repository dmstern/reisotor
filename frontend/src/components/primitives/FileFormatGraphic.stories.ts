import type { Meta, StoryObj } from '@storybook/vue3';
import FileFormatGraphic from './FileFormatGraphic.vue';

const meta: Meta<typeof FileFormatGraphic> = {
  title: 'Components/Primitives/FileFormatGraphic',
  component: FileFormatGraphic,
  tags: ['autodocs'],
  argTypes: {
    extension: { control: 'text' },
    size: { control: 'select', options: ['sm', 'md', 'lg', 'xl'] },
  },
  args: {
    extension: 'pdf',
    size: 'md',
  },
};

export default meta;
type Story = StoryObj<typeof FileFormatGraphic>;

export const PdfDocument: Story = {
  args: {
    extension: 'pdf',
  },
};

export const WordDocument: Story = {
  args: {
    extension: 'docx',
  },
};

export const ExcelSpreadsheet: Story = {
  args: {
    extension: 'xlsx',
  },
};

export const PowerPointPresentation: Story = {
  args: {
    extension: 'pptx',
  },
};

export const TextFile: Story = {
  args: {
    extension: 'txt',
  },
};

export const ZipArchive: Story = {
  args: {
    extension: 'zip',
  },
};

export const AudioFile: Story = {
  args: {
    extension: 'mp3',
  },
};

export const GenericFile: Story = {
  args: {
    extension: 'epub',
  },
};
