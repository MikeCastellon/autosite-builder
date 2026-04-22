import BookingsView from '../dashboard/bookings/BookingsView.jsx';

export default function AdminAllBookingsTab({ filterByOwnerId }) {
  // In admin mode, BookingsView calls listAllBookings.
  // Passing a userId here doesn't matter when isAdmin=true unless you want to scope.
  // We ignore filterByOwnerId at MVP — admin sees all.
  return <BookingsView userId={filterByOwnerId} isAdmin={true} />;
}
