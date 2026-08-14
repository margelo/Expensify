import type {ActionWithPayload, State} from '@hooks/useWorkletStateMachine';

import type {ComponentProps, Ref} from 'react';
// eslint-disable-next-line no-restricted-imports
import type {ScrollView, ScrollViewComponent} from 'react-native';
import type Reanimated from 'react-native-reanimated';
import type {SharedValue} from 'react-native-reanimated';

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

type ActionSheetAwareScrollViewHandle = ScrollViewComponent | ScrollView | Reanimated.ScrollView;

type ActionSheetAwareScrollViewProps = Omit<ComponentProps<typeof Reanimated.ScrollView>, 'ref'> & {
    ref?: Ref<ActionSheetAwareScrollViewHandle>;
};

type RenderActionSheetAwareScrollViewComponent = (props: ActionSheetAwareScrollViewProps & {ref?: React.Ref<ActionSheetAwareScrollViewHandle>}) => React.ReactElement;

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
