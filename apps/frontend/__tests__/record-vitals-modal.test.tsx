import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithQuery } from './test-utils';

const post = vi.fn();
vi.mock('@/lib/api', () => ({ api: { post: (...a: any[]) => post(...a), get: vi.fn() } }));

import { RecordVitalsModal } from '@/components/modules/record-vitals-modal';

const field = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement;

describe('RecordVitalsModal', () => {
  beforeEach(() => post.mockReset());

  it('previews BMI from height and weight', async () => {
    renderWithQuery(<RecordVitalsModal open onClose={() => {}} patientId="p1" patientName="Rahul Verma" />);
    expect(screen.getByText(/Record vitals — Rahul Verma/)).toBeInTheDocument();
    await userEvent.type(field(/Height/), '170');
    await userEvent.type(field(/Weight/), '72');
    expect(screen.getByText('24.9')).toBeInTheDocument();
  });

  it('posts the readings and notifies the caller on success', async () => {
    post.mockResolvedValue({ data: { data: { id: 'v1' } } });
    const onSaved = vi.fn();
    const onClose = vi.fn();
    renderWithQuery(<RecordVitalsModal open onClose={onClose} onSaved={onSaved} patientId="p1" appointmentId="a1" />);
    await userEvent.type(field(/Systolic/), '128');
    await userEvent.type(field(/Pulse/), '76');
    await userEvent.click(screen.getByRole('button', { name: /save vitals/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith('/patients/p1/vitals', expect.objectContaining({ systolic: '128', pulse: '76', appointmentId: 'a1' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the API error and stays open when saving fails', async () => {
    post.mockImplementationOnce(async () => {
      throw Object.assign(new Error('Bad Request'), { response: { data: { error: { message: 'Record at least one vital sign' } } } });
    });
    const onClose = vi.fn();
    renderWithQuery(<RecordVitalsModal open onClose={onClose} patientId="p1" />);
    await userEvent.click(screen.getByRole('button', { name: /save vitals/i }));
    expect(await screen.findByText('Record at least one vital sign')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
