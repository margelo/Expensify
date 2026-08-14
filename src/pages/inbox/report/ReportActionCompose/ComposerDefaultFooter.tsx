import OfflineIndicator from '@components/OfflineIndicator';

import useThemeStyles from '@hooks/useThemeStyles';

import React from 'react';

import ComposerExceededLength from './ComposerExceededLength';
import ComposerFooter from './ComposerFooter';
import ComposerTypingIndicator from './ComposerTypingIndicator';

function ComposerDefaultFooter() {
    const styles = useThemeStyles();

    return (
        <ComposerFooter>
            <OfflineIndicator containerStyles={[styles.chatItemComposeSecondaryRow]} />
            <ComposerTypingIndicator />
            <ComposerExceededLength />
        </ComposerFooter>
    );
}

export default ComposerDefaultFooter;
