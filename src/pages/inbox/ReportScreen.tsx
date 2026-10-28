import CollapsibleHeaderOnKeyboard from '@components/CollapsibleHeaderOnKeyboard';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import ScreenWrapper from '@components/ScreenWrapper';
import ScreenWrapperOfflineIndicators from '@components/ScreenWrapper/ScreenWrapperOfflineIndicators';
import WideRHPOverlayWrapper from '@components/WideRHPOverlayWrapper';

import {useCurrentReportIDState} from '@hooks/useCurrentReportID';
import useOnyx from '@hooks/useOnyx';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useSafeAreaPaddings from '@hooks/useSafeAreaPaddings';
import useSubmitToDestinationVisible from '@hooks/useSubmitToDestinationVisible';
import useThemeStyles from '@hooks/useThemeStyles';
import useViewportOffsetTop from '@hooks/useViewportOffsetTop';

import {removeFailedReport} from '@libs/actions/Report';
import canUseKeyboardGestureArea from '@libs/canUseKeyboardGestureArea';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import Navigation from '@libs/Navigation/Navigation';
import {isInvoiceReport, isMoneyRequestReport} from '@libs/ReportUtils';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import SCREENS from '@src/SCREENS';

import type {ViewStyle} from 'react-native';

import {PortalHost} from '@gorhom/portal';
import React, {useState} from 'react';
import {View} from 'react-native';
import {KeyboardGestureArea, KeyboardStickyView} from 'react-native-keyboard-controller';

import type ReportScreenNavigationProps from './types';

import {ActionListContextProvider} from './ActionListContext';
import {AgentZeroStatusProvider} from './AgentZeroStatusContext';
import {ConciergeDraftProvider} from './ConciergeDraftContext';
import DeleteTransactionNavigateBackHandler from './DeleteTransactionNavigateBackHandler';
import useDeferNonEssentials from './hooks/useDeferNonEssentials';
import LinkedActionNotFoundGuard from './LinkedActionNotFoundGuard';
import OneTransactionThreadRedirectHandler from './OneTransactionThreadRedirectHandler';
import ReactionListWrapper from './ReactionListWrapper';
import ReportActionCompose from './report/ReportActionCompose/ReportActionCompose';
import {ReportActionEditMessageContextProvider, ReportScreenEditMessageProviderWithTransactionThread} from './report/ReportActionEditMessageContext';
import ReportFooter from './report/ReportFooter';
import useClearReportActionDraftsOnReportChange from './report/useClearReportActionDraftsOnReportChange';
import {ReportActionsWithInboxTabDeferredMount} from './ReportActions';
import ReportDragAndDropProvider from './ReportDragAndDropProvider';
import ReportFetchHandler from './ReportFetchHandler';
import ReportHeader from './ReportHeader';
import ReportLifecycleHandler from './ReportLifecycleHandler';
import ReportNavigateAwayHandler from './ReportNavigateAwayHandler';
import ReportNotFoundGuard from './ReportNotFoundGuard';
import ReportRouteParamHandler from './ReportRouteParamHandler';
import WideRHPReceiptPanel from './WideRHPReceiptPanel';

type ReportScreenProps = ReportScreenNavigationProps & {
    /** Whether to defer mounting report actions during the initial Inbox tab navigation */
    shouldDeferReportActions?: boolean;
};

type ReportScreenEditMessageProviderProps = {
    reportID: string | undefined;
    children: React.ReactNode;
};

/** Money-request screens need transaction-thread derivation; others use the lighter provider path. */
function ReportScreenEditMessageProvider({reportID, children}: ReportScreenEditMessageProviderProps) {
    const [shouldDeriveMoneyRequestTransactionThread] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`, {
        selector: (reportEntry) => !!reportEntry && isMoneyRequestReport(reportEntry),
    });

    if (shouldDeriveMoneyRequestTransactionThread !== true) {
        return <ReportActionEditMessageContextProvider reportID={reportID}>{children}</ReportActionEditMessageContextProvider>;
    }

    return <ReportScreenEditMessageProviderWithTransactionThread reportID={reportID}>{children}</ReportScreenEditMessageProviderWithTransactionThread>;
}

function ReportScreen({route, navigation, shouldDeferReportActions = false}: ReportScreenProps) {
    const styles = useThemeStyles();
    const reportIDFromRoute = getNonEmptyStringOnyxID(route.params?.reportID);
    // Wide panes already render the composer's inline offline indicator.
    // eslint-disable-next-line rulesdir/prefer-shouldUseNarrowLayout-instead-of-isSmallScreenWidth
    const {isInNarrowPaneModal, isSmallScreenWidth} = useResponsiveLayout();
    const {currentReportID: currentReportIDValue} = useCurrentReportIDState();
    const viewportOffsetTop = useViewportOffsetTop();
    const isTopMostReportId = currentReportIDValue === reportIDFromRoute;
    const isKeyboardInteractionEnabled = isTopMostReportId || isInNarrowPaneModal;
    const safeAreaPaddings = useSafeAreaPaddings(true);
    const [composerHeight, setComposerHeight] = useState<number>(CONST.CHAT_FOOTER_MIN_HEIGHT);
    const [isComposerFullSize = false] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_IS_COMPOSER_FULL_SIZE}${reportIDFromRoute}`);
    const screenWrapperStyle: ViewStyle[] = [styles.appContent, styles.flex1, {marginTop: viewportOffsetTop}];

    const shouldDeferNonEssentials = useDeferNonEssentials(reportIDFromRoute);

    useSubmitToDestinationVisible(
        [CONST.TELEMETRY.SUBMIT_FOLLOW_UP_ACTION.DISMISS_MODAL_AND_OPEN_REPORT, CONST.TELEMETRY.SUBMIT_FOLLOW_UP_ACTION.DISMISS_MODAL_ONLY],
        reportIDFromRoute,
        CONST.TELEMETRY.SUBMIT_TO_DESTINATION_VISIBLE_TRIGGER.FOCUS,
    );

    const [reportPendingActionAndErrors] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportIDFromRoute}`, {
        selector: (r) => ({
            reportPendingAction: r?.pendingFields?.createReport ?? r?.pendingFields?.reportName,
            reportErrors: r?.errorFields?.createReport,
            isKeyboardAwareList: canUseKeyboardGestureArea() && !!r && !isMoneyRequestReport(r) && !isInvoiceReport(r),
        }),
    });
    const {reportPendingAction, reportErrors, isKeyboardAwareList} = reportPendingActionAndErrors ?? {};
    const isKeyboardAwareLayout = !!isKeyboardAwareList && !isComposerFullSize;

    const dismissReportCreationError = () => {
        Navigation.goBack(undefined, {
            afterTransition: () => removeFailedReport(reportIDFromRoute),
        });
    };

    useClearReportActionDraftsOnReportChange(reportIDFromRoute);

    return (
        <ReportScreenEditMessageProvider reportID={reportIDFromRoute}>
            <WideRHPOverlayWrapper shouldWrap={route.name === SCREENS.RIGHT_MODAL.SEARCH_REPORT}>
                <ActionListContextProvider>
                    <ReactionListWrapper>
                        <ScreenWrapper
                            navigation={navigation}
                            style={screenWrapperStyle}
                            shouldEnableKeyboardAvoidingView={isKeyboardInteractionEnabled && !isKeyboardAwareLayout}
                            shouldShowOfflineIndicator={isKeyboardAwareLayout ? false : undefined}
                            shouldShowOfflineIndicatorInWideScreen={isKeyboardAwareLayout ? false : undefined}
                            enableEdgeToEdgeBottomSafeAreaPadding={isKeyboardAwareLayout ? true : undefined}
                            testID={`report-screen-${reportIDFromRoute}`}
                        >
                            {!shouldDeferNonEssentials && (
                                <>
                                    <DeleteTransactionNavigateBackHandler />
                                    <ReportRouteParamHandler />
                                    <OneTransactionThreadRedirectHandler />
                                    <ReportFetchHandler />
                                    <ReportNavigateAwayHandler />
                                </>
                            )}
                            <ReportNotFoundGuard>
                                <LinkedActionNotFoundGuard>
                                    <ReportDragAndDropProvider>
                                        {!shouldDeferNonEssentials && <ReportLifecycleHandler reportID={reportIDFromRoute} />}
                                        <CollapsibleHeaderOnKeyboard>
                                            <ReportHeader />
                                        </CollapsibleHeaderOnKeyboard>
                                        <OfflineWithFeedback
                                            pendingAction={reportPendingAction}
                                            errors={reportErrors}
                                            onClose={dismissReportCreationError}
                                            needsOffscreenAlphaCompositing
                                            style={styles.flex1}
                                            contentContainerStyle={styles.flex1}
                                            errorRowStyles={[styles.ph5, styles.mv2]}
                                        >
                                            <View style={[styles.flex1, styles.flexRow]}>
                                                {!shouldDeferNonEssentials && <WideRHPReceiptPanel />}
                                                <AgentZeroStatusProvider reportID={reportIDFromRoute}>
                                                    <ConciergeDraftProvider reportID={reportIDFromRoute}>
                                                        <KeyboardGestureArea
                                                            style={styles.flex1}
                                                            offset={isKeyboardAwareLayout && isKeyboardInteractionEnabled ? Math.max(0, composerHeight - safeAreaPaddings.paddingBottom) : 0}
                                                            interpolator="ios"
                                                            textInputNativeID={isKeyboardInteractionEnabled ? CONST.COMPOSER.NATIVE_ID : undefined}
                                                            enableSwipeToDismiss={isKeyboardAwareLayout && isKeyboardInteractionEnabled}
                                                        >
                                                            <View
                                                                style={[styles.flex1, styles.justifyContentEnd, styles.overflowHidden]}
                                                                testID="report-actions-view-wrapper"
                                                            >
                                                                <ReportActionsWithInboxTabDeferredMount
                                                                    reportID={reportIDFromRoute}
                                                                    shouldDefer={shouldDeferReportActions}
                                                                />
                                                                <KeyboardStickyView
                                                                    enabled={isKeyboardAwareLayout && isKeyboardInteractionEnabled}
                                                                    style={[isComposerFullSize && styles.h100, isKeyboardAwareLayout && safeAreaPaddings.safeAreaPaddingBottomStyle]}
                                                                    onLayout={(event) => setComposerHeight(event.nativeEvent.layout.height)}
                                                                    offset={{
                                                                        closed: 0,
                                                                        opened: safeAreaPaddings.paddingBottom,
                                                                    }}
                                                                >
                                                                    {shouldDeferNonEssentials ? <ReportActionCompose.Placeholder /> : <ReportFooter />}
                                                                    {isKeyboardAwareLayout && isSmallScreenWidth && (
                                                                        <ScreenWrapperOfflineIndicators
                                                                            shouldMobileOfflineIndicatorStickToBottom={false}
                                                                            addBottomSafeAreaPadding={false}
                                                                        />
                                                                    )}
                                                                </KeyboardStickyView>
                                                            </View>
                                                        </KeyboardGestureArea>
                                                    </ConciergeDraftProvider>
                                                </AgentZeroStatusProvider>
                                            </View>
                                        </OfflineWithFeedback>
                                        <PortalHost name="suggestions" />
                                    </ReportDragAndDropProvider>
                                </LinkedActionNotFoundGuard>
                            </ReportNotFoundGuard>
                        </ScreenWrapper>
                    </ReactionListWrapper>
                </ActionListContextProvider>
            </WideRHPOverlayWrapper>
        </ReportScreenEditMessageProvider>
    );
}

export default ReportScreen;
export type {ReportScreenProps};
