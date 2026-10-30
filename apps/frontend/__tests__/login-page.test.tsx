import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const post = vi.fn();
vi.mock('@/lib/api', () => ({ api: { post: (...a: any[]) => post(...a) } }));

import LoginPage from '@/app/auth/login/page';

describe('Login page', () => {
  beforeEach(() => {
    post.mockReset();
    localStorage.clear();
  });

  it('validates the form before calling the API', async () => {
    render(<LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(await screen.findByText('Invalid email address')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('demo buttons fill the credentials', async () => {
    render(<LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Nurse' }));
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('nurse@medcore.com');
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('Nurse@123');
  });

  it('offers the verification screen when the email is unverified', async () => {
    post.mockImplementationOnce(async () => {
      throw Object.assign(new Error('Unauthorized'), { response: { data: { error: { message: 'Please verify your email before logging in' } } } });
    });
    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText('Email'), 'new@user.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Secret@123');
    await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
    const link = await screen.findByRole('link', { name: /enter your code/i });
    expect(link).toHaveAttribute('href', '/auth/verify-email?email=new%40user.com');
  });

  it('stores the session on success', async () => {
    post.mockResolvedValue({ data: { data: { accessToken: 'a', refreshToken: 'r', user: { id: 'u', role: 'DOCTOR', firstName: 'A', lastName: 'B', email: 'x@y.z' } } } });
    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText('Email'), 'dr@medcore.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Doctor@123');
    await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
    await waitFor(() => expect(localStorage.getItem('accessToken')).toBe('a'));
  });
});
