import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminSettingsPage } from './AdminSettingsPage';

const apiMocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  getMe: vi.fn(),
  saveSettings: vi.fn(),
}));

vi.mock('../../api', () => ({ api: apiMocks }));

describe('AdminSettingsPage', () => {
  beforeEach(() => {
    apiMocks.getSettings.mockReset().mockResolvedValue({ site_name: '知识库' });
    apiMocks.getMe.mockReset().mockResolvedValue({ username: 'admin' });
    apiMocks.saveSettings.mockReset().mockResolvedValue(undefined);
  });

  it('saves settings without invalidating the removed public site cache', async () => {
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');

    render(<AdminSettingsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '保存站点设置' }));

    await waitFor(() => expect(apiMocks.saveSettings).toHaveBeenCalledOnce());
    expect(removeItem).not.toHaveBeenCalledWith('cached_site_info');
    expect(screen.getByRole('status').textContent).toContain('系统全局配置已成功保存并立即生效');
  });
});
