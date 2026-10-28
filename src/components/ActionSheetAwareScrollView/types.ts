import type {ActionWithPayload, State} from '@hooks/useWorkletStateMachine';

import type {ComponentRef, Ref} from 'react';
// eslint-disable-next-line no-restricted-imports
import type {ScrollView, ScrollViewComponent, ScrollViewProps} from 'react-native';
import type Reanimated from 'react-native-reanimated';
import type {AnimatedScrollViewProps, SharedValue} from 'react-native-reanimated';

type ActionSheetAwareScrollViewMeasurements = {
    frameY?: number;
    popoverHeight?: number;
    height?: number;
    composerHeight?: number;
};

type ActionSheetAwareScrollViewState = State<ActionSheetAwareScrollViewMeasurements>;

type ActionSheetAwareScrollViewStateContextValue = {
    currentActionSheetState: SharedValue<ActionSheetAwareScrollViewState>;
};

type ActionSheetAwareScrollViewActionsContextValue = {
    transitionActionSheetState: (action: ActionWithPayload) => void;
    transitionActionSheetStateWorklet: (action: ActionWithPayload) => void;
    resetStateMachine: () => void;
};

type ActionSheetAwareScrollViewContextValue = ActionSheetAwareScrollViewStateContextValue & ActionSheetAwareScrollViewActionsContextValue;

type ActionSheetAwareScrollViewHandle = ComponentRef<typeof ScrollView> | ComponentRef<typeof ScrollViewComponent> | Reanimated.ScrollView;

type ActionSheetAwareScrollViewProps = Omit<AnimatedScrollViewProps, 'ref'> & {
    ref?: Ref<ActionSheetAwareScrollViewHandle>;
};

type RenderActionSheetAwareScrollViewComponent = (props: ActionSheetAwareScrollViewProps) => React.ReactElement<ScrollViewProps>;

export type {
    ActionSheetAwareScrollViewProps,
    ActionSheetAwareScrollViewHandle,
    RenderActionSheetAwareScrollViewComponent,
    ActionSheetAwareScrollViewContextValue,
    ActionSheetAwareScrollViewStateContextValue,
    ActionSheetAwareScrollViewActionsContextValue,
    ActionSheetAwareScrollViewMeasurements,
    ActionSheetAwareScrollViewState,
};
