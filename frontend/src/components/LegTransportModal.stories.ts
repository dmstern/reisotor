import { ref } from 'vue';
import type { Meta, StoryObj } from '@storybook/vue3';
import LegTransportModal from './LegTransportModal.vue';
import type { Spot, User } from '../api/types';

const mockFromSpot: Spot = {
  id: 1,
  trip_id: 1,
  title: 'Berlin Hbf',
  category: 'transport',
  image_url: null,
  note: null,
  note_format: 'html',
  maps_link: null,
  lat: 52.525,
  lng: 13.369,
  is_home: 0,
  address: null,
  start_date: null,
  end_date: null,
  checkin: null,
  checkout: null,
  contact: null,
  amount: null,
  paid_by_user_id: null,
  budget_expense_id: null,
  done: 0,
  created_by: 1,
};

const mockToSpot: Spot = {
  id: 2,
  trip_id: 1,
  title: 'Frankfurt Flughafen',
  category: 'transport',
  image_url: null,
  note: null,
  note_format: 'html',
  maps_link: null,
  lat: 50.05,
  lng: 8.57,
  is_home: 0,
  address: null,
  start_date: null,
  end_date: null,
  checkin: null,
  checkout: null,
  contact: null,
  amount: null,
  paid_by_user_id: null,
  budget_expense_id: null,
  done: 0,
  created_by: 1,
};

const mockUsers: User[] = [
  { id: 1, username: 'Anna', avatar: '🦊', is_admin: true },
  { id: 2, username: 'Ben', avatar: '🐻', is_admin: false },
];

const meta: Meta<typeof LegTransportModal> = {
  title: 'Components/Modals/LegTransportModal',
  component: LegTransportModal,
  tags: ['autodocs'],
  argTypes: {
    modelValue: { control: 'boolean' },
  },
  args: {
    modelValue: true,
  },
};

export default meta;
type Story = StoryObj<typeof LegTransportModal>;

export const Default: Story = {
  render: (args) => ({
    components: { LegTransportModal },
    setup() {
      const isOpen = ref(args.modelValue);
      return { args, isOpen, mockFromSpot, mockToSpot, mockUsers };
    },
    template: `
      <div>
        <button type="button" @click="isOpen = true">Teilstrecken-Modal öffnen</button>
        <LegTransportModal
          v-model="isOpen"
          :from-spot="mockFromSpot"
          :to-spot="mockToSpot"
          :users="mockUsers"
        />
      </div>
    `,
  }),
};
