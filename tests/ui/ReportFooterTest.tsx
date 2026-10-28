import {act, render, screen} from '@testing-library/react-native';

import ComposeProviders from '@components/ComposeProviders';
import {LocaleContextProvider} from '@components/LocaleContextProvider';
import OnyxListItemProvider from '@components/OnyxListItemProvider';
import SwipeableView from '@components/SwipeableView';
import type SwipeableViewProps from '@components/SwipeableView/types';

import useResponsiveLayout from '@hooks/useResponsiveLayout';

import canUseKeyboardGestureArea from '@libs/canUseKeyboardGestureArea';

import ReportActionCompose from '@pages/inbox/report/ReportActionCompose/ReportActionCompose';
import ReportFooter from '@pages/inbox/report/ReportFooter';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

import type * as ReactNavigation from '@react-navigation/native';

import {useRoute} from '@react-navigation/native';
import React from 'react';
import {Keyboard} from 'react-native';
import Onyx from 'react-native-onyx';

import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

// Mock useResponsiveLayout so each test can pin an exact layout combination.
jest.mock('@hooks/useResponsiveLayout', () => jest.fn());
const mockedUseResponsiveLayout = jest.mocked(useResponsiveLayout);

jest.mock('@pages/inbox/report/ReportActionCompose/ReportActionCompose', () => jest.fn(() => null));
const mockedReportActionCompose = jest.mocked(ReportActionCompose);

jest.mock('@components/MerchantRuleSuggestionBanner', () => jest.fn(() => null));

jest.mock('@components/SwipeableView', () => jest.fn(({children}: SwipeableViewProps) => children));
const mockedSwipeableView = jest.mocked(SwipeableView);

jest.mock('@libs/canUseKeyboardGestureArea', () => jest.fn(() => true));
const mockedCanUseKeyboardGestureArea = jest.mocked(canUseKeyboardGestureArea);

jest.mock('@react-navigation/native', () => {
    const actualNav = jest.requireActual<typeof ReactNavigation>('@react-navigation/native');
    return {
        ...actualNav,
        useRoute: jest.fn(),
    };
});
const mockedUseRoute = jest.mocked(useRoute);

const REPORT_ID = '1';
const OFFLINE_MESSAGE = 'You appear to be offline.';

const mockLayout = ({isSmallScreenWidth, isInNarrowPaneModal}: {isSmallScreenWidth: boolean; isInNarrowPaneModal: boolean}) =>
    mockedUseResponsiveLayout.mockReturnValue({
        // This mirrors the real hook: shouldUseNarrowLayout is true on small screens OR in a narrow pane modal (RHP).
        shouldUseNarrowLayout: isSmallScreenWidth || isInNarrowPaneModal,
        isSmallScreenWidth,
        isInNarrowPaneModal,
        isSmallScreen: isSmallScreenWidth,
        isMediumScreenWidth: false,
        isLargeScreenWidth: !isSmallScreenWidth,
        isExtraLargeScreenWidth: !isSmallScreenWidth,
        isExtraSmallScreenWidth: false,
        isExtraSmallScreenHeight: false,
        onboardingIsMediumOrLargerScreenWidth: !isSmallScreenWidth,
        isInLandscapeMode: false,
    });

/** Archived chat: canUserPerformWriteAction() is false, so ReportFooter renders the archived branch. */
const setUpArchivedReport = async () => {
    await act(async () => {
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`, {reportID: REPORT_ID, type: CONST.REPORT.TYPE.CHAT});
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${REPORT_ID}`, {private_isArchived: new Date().toString()});
    });
};

/** Read-only chat: a non-empty permissions array without "write"/"auditor" hits the read-only branch. */
const setUpReadOnlyReport = async () => {
    await act(async () => {
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`, {
            reportID: REPORT_ID,
            type: CONST.REPORT.TYPE.CHAT,
            permissions: [CONST.REPORT.PERMISSIONS.READ],
        });
    });
};

const renderReportFooter = () =>
    render(
        <ComposeProviders components={[OnyxListItemProvider, LocaleContextProvider]}>
            <ReportFooter />
        </ComposeProviders>,
    );

describe('ReportFooter', () => {
    beforeAll(() => Onyx.init({keys: ONYXKEYS}));

    beforeEach(async () => {
        mockedUseRoute.mockReturnValue({key: 'report', name: 'Report', params: {reportID: REPORT_ID}});
        mockedCanUseKeyboardGestureArea.mockReturnValue(true);
        await act(async () => {
            await Onyx.merge(ONYXKEYS.NETWORK, {shouldForceOffline: true});
        });
    });

    afterEach(async () => {
        await act(async () => {
            await Onyx.clear();
        });
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    it.each([
        {name: 'regular chat', type: CONST.REPORT.TYPE.CHAT, fullSize: false, gestureSupported: true, usesLegacySwipe: false},
        {name: 'expanded chat', type: CONST.REPORT.TYPE.CHAT, fullSize: true, gestureSupported: true, usesLegacySwipe: true},
        {name: 'expense report', type: CONST.REPORT.TYPE.EXPENSE, fullSize: false, gestureSupported: true, usesLegacySwipe: true},
        {name: 'chat on older Android', type: CONST.REPORT.TYPE.CHAT, fullSize: false, gestureSupported: false, usesLegacySwipe: true},
    ])('preserves keyboard dismissal for $name', async ({type, fullSize, gestureSupported, usesLegacySwipe}) => {
        // Given a writable report with its requested composer size.
        mockedCanUseKeyboardGestureArea.mockReturnValue(gestureSupported);
        mockLayout({isSmallScreenWidth: true, isInNarrowPaneModal: false});
        const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss');
        await act(async () => {
            await Onyx.merge(ONYXKEYS.SESSION, {
                accountID: 1,
                email: 'tester@example.com',
            });
            await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`, {
                reportID: REPORT_ID,
                type,
            });
            await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT_IS_COMPOSER_FULL_SIZE}${REPORT_ID}`, fullSize);
        });

        // When the composer mounts.
        renderReportFooter();
        await waitForBatchedUpdatesWithAct();

        // Then the keyboard controller handles regular chat swipes while legacy layouts retain their dismissal callback.
        expect(mockedReportActionCompose).toHaveBeenCalled();
        if (!usesLegacySwipe) {
            expect(mockedSwipeableView).not.toHaveBeenCalled();
            return;
        }
        const swipeProps = mockedSwipeableView.mock.calls.at(-1)?.[0];
        expect(swipeProps).toBeDefined();
        swipeProps?.onSwipeDown();
        expect(dismissKeyboard).toHaveBeenCalledTimes(1);
    });

    describe.each([
        {name: 'archived', setUpReport: setUpArchivedReport, bannerText: 'This chat room has been archived.'},
        {name: 'read-only', setUpReport: setUpReadOnlyReport, bannerText: 'This conversation is read-only.'},
    ])('$name footer while offline', ({setUpReport, bannerText}) => {
        it('shows the offline indicator in an RHP chat on a wide screen', async () => {
            // RHP makes shouldUseNarrowLayout true, but ScreenWrapper only renders the page-level indicator on
            // small screens, so the footer has to render its own inline one here.
            mockLayout({isSmallScreenWidth: false, isInNarrowPaneModal: true});
            await setUpReport();
            renderReportFooter();
            await waitForBatchedUpdatesWithAct();

            expect(screen.getByText(bannerText)).toBeOnTheScreen();
            expect(screen.getByText(OFFLINE_MESSAGE)).toBeOnTheScreen();
        });

        it('hides the offline indicator on a small screen so it is not duplicated', async () => {
            // The page-level ScreenWrapper indicator already covers small screens.
            mockLayout({isSmallScreenWidth: true, isInNarrowPaneModal: false});
            await setUpReport();
            renderReportFooter();
            await waitForBatchedUpdatesWithAct();

            // Assert the branch actually rendered, so the absence of the indicator below is meaningful.
            expect(screen.getByText(bannerText)).toBeOnTheScreen();
            expect(screen.queryByText(OFFLINE_MESSAGE)).not.toBeOnTheScreen();
        });
    });
});
