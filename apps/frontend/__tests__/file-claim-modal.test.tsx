import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithQuery } from './test-utils';

const post = vi.fn();
const get = vi.fn();
vi.mock('@/lib/api', () => ({ api: { post: (...a: any[]) => post(...a), get: (...a: any[]) => get(...a) } }));

import { FileClaimModal } from '@/components/modules/file-claim-modal';

const invoice = {
  id: 'inv1',
  invoiceNumber: 'INV-2026-00042',
  patientId: 'p1',
  balanceAmount: '1800',
  patient: { user: { firstName: 'Rahul', lastName: 'Verma' } },
};

describe('FileClaimModal', () => {
  beforeEach(() => {
    post.mockReset();
    get.mockReset();
    get.mockResolvedValue({ data: { data: { id: 'p1', insuranceProvider: 'Star Health', insurancePolicyNumber: 'SH-1001' } } });
  });

  it('pre-fills the policy from the patient and the amount from the balance, then submits', async () => {
    post.mockResolvedValue({ data: { data: { id: 'c1' } } });
    const onClose = vi.fn();
    renderWithQuery(<FileClaimModal open invoice={invoice} onClose={onClose} />);

    expect(screen.getByText('INV-2026-00042')).toBeInTheDocument();
    await waitFor(() => expect((screen.getByLabelText('Insurer') as HTMLInputElement).value).toBe('Star Health'));
    expect((screen.getByLabelText('Policy number') as HTMLInputElement).value).toBe('SH-1001');
    expect((screen.getByLabelText(/Claim amount/) as HTMLInputElement).value).toBe('1800');

    await userEvent.type(screen.getByLabelText(/TPA/), 'MediAssist');
    await userEvent.click(screen.getByRole('button', { name: /submit claim/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith(
      '/insurance-claims',
      expect.objectContaining({ invoiceId: 'inv1', insurer: 'Star Health', tpaName: 'MediAssist', policyNumber: 'SH-1001', claimedAmount: 1800 }),
    );
  });

  it('surfaces a server-side rejection', async () => {
    post.mockImplementationOnce(async () => {
      throw Object.assign(new Error('Conflict'), { response: { data: { error: { message: 'Claim CLM-2026-00001 is already open for this invoice' } } } });
    });
    renderWithQuery(<FileClaimModal open invoice={invoice} onClose={() => {}} />);
    await waitFor(() => expect((screen.getByLabelText('Insurer') as HTMLInputElement).value).toBe('Star Health'));
    await userEvent.click(screen.getByRole('button', { name: /submit claim/i }));
    expect(await screen.findByText(/already open for this invoice/)).toBeInTheDocument();
  });
});
