import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Users } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badge';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states';
import { Modal } from '@/components/shared/modal';

describe('shared UI components', () => {
  it('StatusBadge humanises the status and applies its colour', () => {
    render(<StatusBadge status="PARTIALLY_APPROVED" />);
    const badge = screen.getByText('PARTIALLY APPROVED');
    expect(badge.className).toContain('bg-amber-50');
  });

  it('StatusBadge falls back to a neutral style for unknown statuses', () => {
    render(<StatusBadge status="SOMETHING_ELSE" />);
    expect(screen.getByText('SOMETHING ELSE').className).toContain('bg-gray-100');
  });

  it('StatCard shows value, label and hint', () => {
    render(<StatCard label="Beds occupied" value="39/60" icon={Users} hint="65% occupancy" />);
    expect(screen.getByText('39/60')).toBeInTheDocument();
    expect(screen.getByText('Beds occupied')).toBeInTheDocument();
    expect(screen.getByText('65% occupancy')).toBeInTheDocument();
  });

  it('ErrorState calls onRetry', async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Could not load wards." onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('EmptyState and LoadingState render their text', () => {
    render(
      <>
        <EmptyState title="No patients found" description="Try another search" />
        <LoadingState label="Opening chart…" />
      </>,
    );
    expect(screen.getByText('No patients found')).toBeInTheDocument();
    expect(screen.getByText('Opening chart…')).toBeInTheDocument();
  });

  it('Modal renders only when open and closes on Escape', async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal open={false} onClose={onClose} title="Hidden">
        body
      </Modal>,
    );
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
    rerender(
      <Modal open onClose={onClose} title="Record vitals">
        body
      </Modal>,
    );
    expect(screen.getByText('Record vitals')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
