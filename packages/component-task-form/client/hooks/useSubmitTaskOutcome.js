import React, { useContext } from 'react';
import useCompleteInstanceTask from './../mutations/completeInstanceTask';
import useDestroyInstance from './../mutations/destroyInstance';
import AuthenticatedUserContext from 'component-authentication/client/AuthenticatedUserContext';


const SubmitTaskFailureReason = {
    RequiresValidatedSubmitter: 'RequiresValidatedSubmitter',
    FormValidationFailed: 'FormValidationFailed'
};



export default  function useSubmitTaskOutcome(instanceId, formDefinition, instanceType, saveInstanceData, validateForm, submitDidFail, wasSubmitted) {

    const completeInstanceTask = useCompleteInstanceTask(instanceType);
    const destroyInstance = useDestroyInstance(instanceType);
    const currentUser = useContext(AuthenticatedUserContext);

    const _submitDidFail = (reason) => {
        return submitDidFail && submitDidFail(reason);
    };


    return (taskId, outcomeType, options) => {

        // From the task definition we want to find the outcome requested.
        // The outcome can have state variable changes requested alongside it that need
        // to be sent to the server at the same time.

        const outcome = formDefinition.findMatchingOutcome(outcomeType);
        if(!outcome) {
            throw new Error(`Unable to find matching outcome for outcome type (${outcomeType})`);
        }

        // Determine state changes that have been requested, fields should be filtered down to those that are
        // marked as being state variables within the tasks model definition.

        if(outcome.result === "Complete") {

            if(outcome.requiresValidatedSubmitter === true && (!currentUser || !currentUser.emailIsValidated)) {
                return _submitDidFail(SubmitTaskFailureReason.RequiresValidatedSubmitter);
            }

            if(outcome.skipValidations !== true && validateForm && !validateForm()) {
                return _submitDidFail(SubmitTaskFailureReason.FormValidationFailed);
            }


            const state = instanceType.filterObjectToStateVariables(outcome._graphqlState || {});

            return saveInstanceData().then(() => {

                return completeInstanceTask(instanceId, taskId, formDefinition.name, outcome.type, state);

            }).then(result => {

                // The server also enforces the requirement that a submitter may have to have an verified/validated email address.
                if(result === 'ValidatedEmailRequired') {

                    return _submitDidFail(SubmitTaskFailureReason.RequiresValidatedSubmitter);

                } else if(result === 'Success') {

                    if(wasSubmitted) {
                        return wasSubmitted(outcome, state);
                    }

                } else if(result === 'ValidationFailed') {

                    return _submitDidFail(SubmitTaskFailureReason.FormValidationFailed);
                }
            });

        } else if(outcome.result === "Destroy") {

            const state = instanceType.filterObjectToStateVariables(outcome._graphqlState || {});

            return destroyInstance(instanceId, state).then(result => {

                if(wasSubmitted) {
                    return wasSubmitted(outcome, state);
                }
            });


        } else if(outcome.result === "Save") {

            // Save doesn't support state changes, just saves the currently modified data back to the instance.

            saveInstanceData().then(() => {
                if(wasSubmitted) {
                    return wasSubmitted(outcome, {});
                }
            });

        }
    };
}

export { SubmitTaskFailureReason };