/**
 * Suggested questions to ask a lawyer, per case stage (1–8). Each question carries a short
 * explanation of why it matters. These are static, general suggestions — not legal advice.
 */
const STAGE_QUESTIONS = {
    1: [
        { q: 'Has my case been properly filed with all required documents?', why: 'Missing or defective documents are a common reason a new case stalls at the registry.' },
        { q: 'Is there any deficiency in the filing that needs to be corrected?', why: 'The registry raises "office objections"; each one unresolved delays the first hearing.' },
        { q: 'When can I expect the case to be admitted?', why: 'It sets a realistic expectation for the first court date.' },
        { q: 'Are there any court fees still outstanding?', why: 'Unpaid or short court fees can hold up registration.' },
        { q: 'Should we file for any urgent interim relief?', why: 'Some relief (like a stay) only helps if it is asked for early.' },
    ],
    2: [
        { q: 'Has the court admitted our case? If not, what are the objections?', why: 'Admission is the gate to every later stage.' },
        { q: 'Is the opposite party likely to challenge the admission?', why: 'A challenge at this stage can add months before notices are even issued.' },
        { q: 'How strong is our case at this stage based on the initial filing?', why: 'An honest early assessment helps you decide whether to pursue settlement.' },
        { q: 'Should we apply for any interim orders at admission?', why: 'Interim orders protect your position while the case runs.' },
        { q: 'How long does the admission process typically take in this court?', why: 'Courts differ widely; local experience gives a better estimate than national averages.' },
    ],
    3: [
        { q: 'Has the notice been served on the opposite party?', why: 'The case cannot move forward until service is complete.' },
        { q: 'Has the opposite party filed their written statement?', why: 'There is a legal time limit for the written statement; delays here are common.' },
        { q: 'Is the written statement raising any unexpected defences?', why: 'New defences change what evidence you need to prepare.' },
        { q: 'Should we file a reply to their written statement?', why: 'A reply lets you answer new points before issues are framed.' },
        { q: 'What is the deadline for them to file the written statement?', why: 'Knowing the deadline lets you object if the other side keeps asking for more time.' },
    ],
    4: [
        { q: 'What issues has the court framed in our case?', why: 'The framed issues decide what each side must prove.' },
        { q: 'Are the framed issues favourable to our side?', why: 'Badly worded issues can leave your key claim outside the trial.' },
        { q: 'Should we challenge any of the framed issues?', why: 'Issues are easier to correct now than after evidence starts.' },
        { q: 'What evidence do we need for each framed issue?', why: 'It turns the issues into a concrete checklist of documents and witnesses.' },
        { q: 'How does framing of issues affect our overall strategy?', why: 'It is the natural point to revisit the plan and the likely timeline.' },
    ],
    5: [
        { q: 'Which witnesses have we listed and when will they be examined?', why: 'Witness availability is a leading cause of adjournments at this stage.' },
        { q: 'Have all our documents been properly marked as exhibits?', why: 'Documents that are not formally exhibited may not be considered by the court.' },
        { q: 'What is the strongest piece of evidence we have and is it on record?', why: 'It confirms that the best evidence has actually been submitted.' },
        { q: 'What will happen if a witness fails to appear on the next date?', why: 'A missing witness usually means another adjournment; a backup plan saves months.' },
        { q: 'How many more hearings do you estimate before our evidence is complete?', why: 'It gives you a rough budget and timeline.' },
    ],
    6: [
        { q: 'What evidence is the other side presenting?', why: 'You need to know what you must be ready to challenge.' },
        { q: 'Are we prepared for cross-examination of their witnesses?', why: 'Cross-examination is the main way to test the other side’s evidence.' },
        { q: 'Are they introducing any surprise documents or witnesses?', why: 'Late additions can usually be objected to, but only if raised promptly.' },
        { q: 'Can we object to any of their evidence?', why: 'Objections are best raised when the evidence is tendered.' },
        { q: 'How does their evidence compare to ours in strength?', why: 'It informs whether settlement is worth considering before arguments.' },
    ],
    7: [
        { q: 'What are the main points you plan to argue?', why: 'You should understand the story your lawyer will tell the judge.' },
        { q: 'Have you prepared written arguments to submit?', why: 'Written submissions often carry weight and shorten oral hearings.' },
        { q: 'What are the key case laws you are citing in our favour?', why: 'Precedent is central to final arguments.' },
        { q: 'What are the weakest points the other side might exploit?', why: 'Knowing the risks helps you judge any settlement offer.' },
        { q: 'How many hearing dates do you expect for final arguments?', why: 'It helps you plan time off work and costs.' },
    ],
    8: [
        { q: 'When is the judgment expected to be pronounced?', why: 'Judgment can be reserved for weeks or months; ask what the court has indicated.' },
        { q: 'Based on the arguments, what is your honest assessment of the outcome?', why: 'It prepares you for either result.' },
        { q: 'If the judgment is against us, what are our appeal options?', why: 'Appeals have strict time limits.' },
        { q: 'How long do we have to file an appeal after judgment?', why: 'Missing the limitation period can end your options.' },
        { q: 'Should we prepare for execution proceedings if we win?', why: 'A favourable judgment still has to be enforced, which is a separate process.' },
    ],
};

function questionsForStage(stage) {
    return STAGE_QUESTIONS[stage] || STAGE_QUESTIONS[5];
}

module.exports = { STAGE_QUESTIONS, questionsForStage };
