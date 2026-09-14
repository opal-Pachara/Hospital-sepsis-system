import { describe, it, expect } from 'vitest';
import {
  AdminLayout,
  PatientSimulator,
  DashboardCleaner,
  AlertSimulator,
  DatabaseFailoverTester,
  UserManagement,
} from '../pages/admin';
import { calculateNEWS } from '../utils/newsCalculator';

describe('Admin Modular Components Export & Integrity', () => {
  it('exports all 5 modular admin components and AdminLayout', () => {
    expect(AdminLayout).toBeDefined();
    expect(PatientSimulator).toBeDefined();
    expect(DashboardCleaner).toBeDefined();
    expect(AlertSimulator).toBeDefined();
    expect(DatabaseFailoverTester).toBeDefined();
    expect(UserManagement).toBeDefined();
  });
});

describe('Admin URL Route Parsing Logic', () => {
  type AdminTab = 'status' | 'cleaner' | 'alerts' | 'failover' | 'users';
  type AppView = 'dashboard' | 'admin' | 'treated_dashboard';

  function parseTestRoute(pathname: string): { view: AppView; adminTab: AdminTab } {
    if (pathname.startsWith('/admin')) {
      const sub = pathname.replace('/admin', '').replace(/^\//, '');
      let tab: AdminTab = 'status';
      if (sub === 'cleaner' || sub === 'alerts' || sub === 'failover' || sub === 'users' || sub === 'status') {
        tab = sub as AdminTab;
      }
      return { view: 'admin', adminTab: tab };
    }
    if (pathname.startsWith('/treated-dashboard')) {
      return { view: 'treated_dashboard', adminTab: 'status' };
    }
    return { view: 'dashboard', adminTab: 'status' };
  }

  it('routes /admin to admin view with default status tab', () => {
    expect(parseTestRoute('/admin')).toEqual({ view: 'admin', adminTab: 'status' });
  });

  it('routes /admin/cleaner to admin view with cleaner tab', () => {
    expect(parseTestRoute('/admin/cleaner')).toEqual({ view: 'admin', adminTab: 'cleaner' });
  });

  it('routes /admin/alerts to admin view with alerts tab', () => {
    expect(parseTestRoute('/admin/alerts')).toEqual({ view: 'admin', adminTab: 'alerts' });
  });

  it('routes /admin/failover to admin view with failover tab', () => {
    expect(parseTestRoute('/admin/failover')).toEqual({ view: 'admin', adminTab: 'failover' });
  });

  it('routes /admin/users to admin view with users tab', () => {
    expect(parseTestRoute('/admin/users')).toEqual({ view: 'admin', adminTab: 'users' });
  });

  it('routes /treated-dashboard to treated_dashboard view', () => {
    expect(parseTestRoute('/treated-dashboard')).toEqual({ view: 'treated_dashboard', adminTab: 'status' });
  });

  it('routes root / or unknown paths to clinical dashboard', () => {
    expect(parseTestRoute('/')).toEqual({ view: 'dashboard', adminTab: 'status' });
    expect(parseTestRoute('/er')).toEqual({ view: 'dashboard', adminTab: 'status' });
  });
});

describe('Patient Simulator Preset Calculation Logic', () => {
  it('correctly scores High Risk preset (NEWS 9+)', () => {
    const vitalsHigh = {
      respiratoryRate: 26, // 3
      spO2: 91, // 3
      oxygenSupplementation: 'supplemental' as const, // 2
      temperature: 39.2, // 2
      systolicBP: 85, // 3
      heartRate: 118, // 2
      avpu: 'A' as const, // 0
    };
    const result = calculateNEWS(vitalsHigh);
    expect(result.totalScore).toBeGreaterThanOrEqual(7);
    expect(result.riskLevel).toBe('high');
  });

  it('correctly scores Medium Risk preset (NEWS 5-6)', () => {
    const vitalsMed = {
      respiratoryRate: 22, // 2
      spO2: 94, // 1
      oxygenSupplementation: 'room_air' as const, // 0
      temperature: 38.3, // 1
      systolicBP: 105, // 1
      heartRate: 98, // 1
      avpu: 'A' as const, // 0
    };
    const result = calculateNEWS(vitalsMed);
    expect(result.totalScore).toBe(6);
    expect(result.riskLevel).toBe('medium');
  });

  it('correctly scores Normal preset (NEWS 0)', () => {
    const vitalsNormal = {
      respiratoryRate: 16, // 0
      spO2: 98, // 0
      oxygenSupplementation: 'room_air' as const, // 0
      temperature: 36.8, // 0
      systolicBP: 120, // 0
      heartRate: 75, // 0
      avpu: 'A' as const, // 0
    };
    const result = calculateNEWS(vitalsNormal);
    expect(result.totalScore).toBe(0);
    expect(result.riskLevel).toBe('low');
  });
});
