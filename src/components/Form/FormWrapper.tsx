import React, {useCallback, useMemo, useRef} from 'react';
import type {RefObject} from 'react';
// eslint-disable-next-line no-restricted-imports
import type {ScrollView as RNScrollView, StyleProp, ViewStyle} from 'react-native';
import {Keyboard, View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import FormAlertWithSubmitButton from '@components/FormAlertWithSubmitButton';
import FormElement from '@components/FormElement';
import ScrollView from '@components/ScrollView';
import ScrollViewWithContext from '@components/ScrollViewWithContext';
import useStyledSafeAreaInsets from '@hooks/useStyledSafeAreaInsets';
import useThemeStyles from '@hooks/useThemeStyles';
import {getLatestErrorMessage} from '@libs/ErrorUtils';
import type {OnyxFormKey} from '@src/ONYXKEYS';
import type {Form} from '@src/types/form';
import type ChildrenProps from '@src/types/utils/ChildrenProps';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import type {FormInputErrors, FormProps, InputRefs} from './types';

type FormWrapperProps = ChildrenProps &
    FormProps & {
        /** Submit button styles */
        submitButtonStyles?: StyleProp<ViewStyle>;

        /** Whether to apply flex to the submit button */
        submitFlexEnabled?: boolean;

        /** Server side errors keyed by microtime */
        errors: FormInputErrors;

        /** Assuming refs are React refs */
        inputRefs: RefObject<InputRefs>;

        /** Whether the submit button is disabled */
        isSubmitDisabled?: boolean;

        /** Callback to submit the form */
        onSubmit: () => void;

        /** Whether the form is loading */
        isLoading?: boolean;

        /**
         * If enabled, the content will have a bottom padding equal to account for the safe bottom area inset.
         */
        addBottomSafeAreaPadding?: boolean;

        /**
         * Whether the submit button should stick to the bottom of the screen.
         */
        shouldSubmitButtonStickToBottom?: boolean;

        /**
         * Whether the submit button should use small paddings.
         */
        shouldSubmitButtonUseSmallPadding?: boolean;
    };

function FormWrapper({
    onSubmit,
    children,
    errors,
    inputRefs,
    submitButtonText,
    footerContent,
    isSubmitButtonVisible = true,
    style,
    submitButtonStyles,
    submitFlexEnabled = true,
    enabledWhenOffline,
    isSubmitActionDangerous = false,
    formID,
    shouldUseScrollView = true,
    scrollContextEnabled = false,
    shouldHideFixErrorsAlert = false,
    disablePressOnEnter = false,
    isSubmitDisabled = false,
    isLoading = false,
    addBottomSafeAreaPadding = false,
    shouldSubmitButtonStickToBottom = false,
    shouldSubmitButtonUseSmallPadding = false,
}: FormWrapperProps) {
    const styles = useThemeStyles();
    const formRef = useRef<RNScrollView>(null);
    const formContentRef = useRef<View>(null);

    const [formState] = useOnyx<OnyxFormKey, Form>(`${formID}`);

    const errorMessage = useMemo(() => (formState ? getLatestErrorMessage(formState) : undefined), [formState]);

    const onFixTheErrorsLinkPressed = useCallback(() => {
        const errorFields = !isEmptyObject(errors) ? errors : formState?.errorFields ?? {};
        const focusKey = Object.keys(inputRefs.current ?? {}).find((key) => Object.keys(errorFields).includes(key));

        if (!focusKey) {
            return;
        }

        const focusInput = inputRefs.current?.[focusKey]?.current;

        // Dismiss the keyboard for non-text fields by checking if the component has the isFocused method, as only TextInput has this method.
        if (typeof focusInput?.isFocused !== 'function') {
            Keyboard.dismiss();
        }

        // We subtract 10 to scroll slightly above the input
        if (formContentRef.current) {
            // We measure relative to the content root, not the scroll view, as that gives
            // consistent results across mobile and web
            focusInput?.measureLayout?.(formContentRef.current, (X: number, y: number) =>
                formRef.current?.scrollTo({
                    y: y - 10,
                    animated: false,
                }),
            );
        }

        // Focus the input after scrolling, as on the Web it gives a slightly better visual result
        focusInput?.focus?.();
    }, [errors, formState?.errorFields, inputRefs]);

    const {paddingBottom} = useStyledSafeAreaInsets(true);
    const SubmitButton = useMemo(() => {
        const paddingStyles = shouldSubmitButtonUseSmallPadding ? {mt: styles.mt3, pb: styles.pb3} : {mt: styles.mt5, pb: styles.pb5};

        return (
            isSubmitButtonVisible && (
                <FormAlertWithSubmitButton
                    buttonText={submitButtonText}
                    isDisabled={isSubmitDisabled}
                    isAlertVisible={((!isEmptyObject(errors) || !isEmptyObject(formState?.errorFields)) && !shouldHideFixErrorsAlert) || !!errorMessage}
                    isLoading={!!formState?.isLoading || isLoading}
                    message={isEmptyObject(formState?.errorFields) ? errorMessage : undefined}
                    onSubmit={onSubmit}
                    footerContent={footerContent}
                    onFixTheErrorsLinkPressed={onFixTheErrorsLinkPressed}
                    containerStyles={[
                        styles.mh0,
                        paddingStyles.mt,
                        submitFlexEnabled ? styles.flex1 : {},
                        submitButtonStyles,
                        shouldSubmitButtonStickToBottom
                            ? [
                                  {
                                      position: 'absolute',
                                      left: 0,
                                      right: 0,
                                      bottom: paddingStyles.pb.paddingBottom + paddingBottom,
                                  },
                                  style,
                              ]
                            : {},
                    ]}
                    enabledWhenOffline={enabledWhenOffline}
                    isSubmitActionDangerous={isSubmitActionDangerous}
                    disablePressOnEnter={disablePressOnEnter}
                    enterKeyEventListenerPriority={1}
                    shouldBlendOpacity={shouldSubmitButtonStickToBottom}
                />
            )
        );
    }, [
        disablePressOnEnter,
        enabledWhenOffline,
        errorMessage,
        errors,
        footerContent,
        formState?.errorFields,
        formState?.isLoading,
        isLoading,
        isSubmitActionDangerous,
        isSubmitButtonVisible,
        isSubmitDisabled,
        onFixTheErrorsLinkPressed,
        onSubmit,
        paddingBottom,
        shouldHideFixErrorsAlert,
        shouldSubmitButtonStickToBottom,
        shouldSubmitButtonUseSmallPadding,
        style,
        styles.flex1,
        styles.mh0,
        styles.mt3,
        styles.mt5,
        styles.pb3,
        styles.pb5,
        submitButtonStyles,
        submitButtonText,
        submitFlexEnabled,
    ]);

    const scrollViewContent = useCallback(
        () => (
            <FormElement
                key={formID}
                ref={formContentRef}
                style={[style, styles.pb5]}
            >
                {children}
                {!shouldSubmitButtonStickToBottom && SubmitButton}
            </FormElement>
        ),
        [formID, style, styles.pb5, children, shouldSubmitButtonStickToBottom, SubmitButton],
    );

    if (!shouldUseScrollView) {
        if (shouldSubmitButtonStickToBottom) {
            return (
                <View style={styles.flex1}>
                    {scrollViewContent()}
                    {SubmitButton}
                </View>
            );
        }

        return scrollViewContent();
    }

    return (
        <View style={styles.flex1}>
            {scrollContextEnabled ? (
                <ScrollViewWithContext
                    style={[styles.w100, styles.flex1]}
                    contentContainerStyle={styles.flexGrow1}
                    keyboardShouldPersistTaps="handled"
                    addBottomSafeAreaPadding={addBottomSafeAreaPadding}
                    ref={formRef}
                >
                    {scrollViewContent()}
                </ScrollViewWithContext>
            ) : (
                <ScrollView
                    style={[styles.w100, styles.flex1]}
                    contentContainerStyle={styles.flexGrow1}
                    keyboardShouldPersistTaps="handled"
                    addBottomSafeAreaPadding={addBottomSafeAreaPadding}
                    ref={formRef}
                >
                    {scrollViewContent()}
                </ScrollView>
            )}
            {shouldSubmitButtonStickToBottom && SubmitButton}
        </View>
    );
}

FormWrapper.displayName = 'FormWrapper';

export default FormWrapper;
