import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { CNR, mockApi } from '../test/fixtures';

const renderAt = (path) => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);

describe('Track page', () => {
    it('does not fetch a CAPTCHA until a valid CNR is entered', async () => {
        const calls = mockApi();
        renderAt('/track');
        await screen.findByText(CNR); // demo case row loaded
        expect(calls.some((c) => c.includes('/api/captcha'))).toBe(false);

        const input = screen.getByLabelText(/cnr number/i);
        fireEvent.change(input, { target: { value: 'mhna0100' } });
        expect(calls.some((c) => c.includes('/api/captcha'))).toBe(false); // still invalid

        fireEvent.change(input, { target: { value: CNR } });
        await waitFor(() => expect(calls.some((c) => c.includes('/api/captcha?courtType=district'))).toBe(true));
        expect(await screen.findByAltText(/captcha/i)).toBeInTheDocument();
    });

    it('rejects CNR characters that are not letters/digits and caps at 16', () => {
        mockApi();
        renderAt('/track');
        const input = screen.getByLabelText(/cnr number/i);
        fireEvent.change(input, { target: { value: 'mh-na 0100 0001 2019 EXTRA' } });
        expect(input.value).toBe('MHNA010000012019');
    });

    it('labels the CNR parts correctly (state, district, court)', () => {
        mockApi();
        renderAt('/track');
        const legend = screen.getByLabelText(/help finding your cnr/i);
        expect(within(legend).getByText('District')).toBeInTheDocument();
        expect(within(legend).getByText('Court')).toBeInTheDocument();
    });
});

describe('Case dashboard', () => {
    it('loads a case by URL and renders the main sections', async () => {
        mockApi();
        renderAt(`/case/${CNR}`);

        expect(await screen.findByRole('heading', { level: 1, name: /Priya Sharma/ })).toBeInTheDocument();
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1); // one h1 per page

        // hearing table: newest first, status labels, order action only where an order exists
        const table = screen.getByRole('table');
        const rows = within(table).getAllByRole('row').slice(1);
        expect(rows).toHaveLength(3);
        expect(within(rows[0]).getByText(/COVID/)).toBeInTheDocument();
        expect(within(table).getAllByRole('button', { name: /read the order/i })).toHaveLength(1);

        // counts come from the API, not recomputed client-side
        expect(screen.getByText(/1 heard · 1 adjourned · 1 unclear/)).toBeInTheDocument();

        // sections driven by secondary endpoints
        expect(screen.getByText(/Stage 5 of 8/)).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /questions for your lawyer/i })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /pre-hearing prep card/i })).toBeInTheDocument();
        expect(screen.getByText(/fictional demo case/i)).toBeInTheDocument();

        // the cost figure is whatever the server computed
        expect(await screen.findByText('₹1,23,456')).toBeInTheDocument();
        expect(screen.getByText((_, el) => el?.tagName === 'P' && /Based on 1 confirmed adjournment · 1 unclear hearing not counted/.test(el.textContent))).toBeInTheDocument();
    });

    it('opens the order summary dialog from a hearing', async () => {
        mockApi();
        renderAt(`/case/${CNR}`);
        fireEvent.click(await screen.findByRole('button', { name: /read the order/i }));
        const dialog = await screen.findByRole('dialog');
        expect(await within(dialog).findByText('Plain summary.')).toBeInTheDocument();
        expect(within(dialog).getByText('Do X')).toBeInTheDocument();
        fireEvent.keyDown(document, { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('shows a "look it up again" state when the case has expired', async () => {
        mockApi({ '^\\/api\\/case\\/[A-Z0-9]+$': () => ({ ok: false, status: 404, json: async () => ({ error: 'case_not_found', message: 'gone' }) }) });
        renderAt('/case/KLTS010000452019');
        expect(await screen.findByText(/couldn't find this case/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /look it up again/i })).toHaveAttribute('href', '/track?cnr=KLTS010000452019&expired=1');
    });
});

describe('Landing page', () => {
    it('has working in-page anchors and no unsourced claims', () => {
        mockApi();
        const { container } = renderAt('/');
        expect(container.querySelector('#how-it-works')).not.toBeNull();
        expect(container.querySelector('#about')).not.toBeNull();
        const text = container.textContent;
        for (const claim of ['64%', '17 Years', '₹1.2', 'never logged', 'NJDG Case Flow', 'Hack2Skill', 'Hack-N-Win']) {
            expect(text).not.toContain(claim);
        }
        expect(screen.getAllByRole('link', { name: /track/i }).length).toBeGreaterThan(0);
    });
});
