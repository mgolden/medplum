import { Button, Group, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { getReferenceString } from '@medplum/core';
import { Practitioner, Schedule } from '@medplum/fhirtypes';
import { Document, useMedplumProfile, useSearchResources } from '@medplum/react';
import dayjs from 'dayjs';
import { useCallback, useContext, useState } from 'react';
import { Calendar, dayjsLocalizer, Event } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useNavigate } from 'react-router-dom';
import { ScheduleContext } from '../Schedule.context';
import { BlockAvailability } from '../components/BlockAvailability';
import { SetAvailability } from '../components/SetAvailability';
import { SlotDetails } from '../components/SlotDetails';

export function SchedulePage(): JSX.Element {
  const navigate = useNavigate();
  const [blockAvailabilityOpened, blockAvailabilityHandlers] = useDisclosure(false);
  const [setAvailabilityOpened, setAvailabilityHandlers] = useDisclosure(false);
  const [slotDetailsOpened, slotDetailsHandlers] = useDisclosure(false);
  const [selectedEvent, setSelectedEvent] = useState<Event>();
  const { schedule } = useContext(ScheduleContext);

  const profile = useMedplumProfile() as Practitioner;
  const [slots] = useSearchResources('Slot', { schedule: getReferenceString(schedule as Schedule), _count: '100' });
  const [appointments] = useSearchResources('Appointment', { actor: getReferenceString(profile as Practitioner) });

  // Converts Slot resources to big-calendar Event objects
  // Only show free and busy-unavailable slots
  const slotEvents: Event[] = (slots ?? [])
    .filter((slot) => slot.status === 'free' || slot.status === 'busy-unavailable')
    .map((slot) => ({
      title: slot.status === 'free' ? 'Available' : 'Blocked',
      start: new Date(slot.start),
      end: new Date(slot.end),
      resource: slot,
    }));

  // Converts Appointment resources to big-calendar Event objects
  // Exclude cancelled appointments to prevent them from overlapping free slots during rendering
  const appointmentEvents: Event[] = (appointments ?? [])
    .filter((appointment) => appointment.status !== 'cancelled')
    .map((appointment) => {
      // Find the patient among the participants to use as title
      const patientParticipant = appointment?.participant?.find((p) => p.actor?.reference?.startsWith('Patient/'));
      const status = !['booked', 'arrived', 'fulfilled'].includes(appointment.status as string)
        ? ` (${appointment.status})`
        : '';

      return {
        title: `${patientParticipant?.actor?.display} ${status}`,
        start: new Date(appointment.start as string),
        end: new Date(appointment.end as string),
        resource: appointment,
      };
    });

  // When a date/time range is selected, set the event object and open the modal
  const handleSelectSlot = useCallback(
    (event: Event) => {
      setSelectedEvent(event);
      slotDetailsHandlers.open();
    },
    [slotDetailsHandlers]
  );

  // When an exiting event is selected, set the event object and open the modal
  const handleSelectEvent = useCallback(
    (event: Event) => {
      if (event.resource.resourceType === 'Slot') {
        // If it's a slot open the management modal
        setSelectedEvent(event);
        slotDetailsHandlers.open();
      } else if (event.resource.resourceType === 'Appointment') {
        // If it's an appointment navigate to the appointment detail page
        navigate(`/Appointment/${event.resource.id}`);
      }
    },
    [slotDetailsHandlers, navigate]
  );

  return (
    <Document width={1000}>
      <Title order={1} mb="lg">
        My Schedule
      </Title>

      <Group mb="lg">
        <Button size="sm" onClick={() => setAvailabilityHandlers.open()}>
          Set Availability
        </Button>
        <Button size="sm" onClick={() => blockAvailabilityHandlers.open()}>
          Block Availability
        </Button>
      </Group>

      <Calendar
        defaultView="week"
        views={['month', 'week', 'day', 'agenda']}
        localizer={dayjsLocalizer(dayjs)}
        events={appointmentEvents}
        backgroundEvents={slotEvents} // Background events don't show in the month view
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        scrollToTime={new Date()} // Scroll to current time
        style={{ height: 600 }}
        selectable
      />

      {/* Modals */}
      <SetAvailability opened={setAvailabilityOpened} handlers={setAvailabilityHandlers} />
      <BlockAvailability opened={blockAvailabilityOpened} handlers={blockAvailabilityHandlers} />
      <SlotDetails event={selectedEvent} opened={slotDetailsOpened} handlers={slotDetailsHandlers} />
    </Document>
  );
}
