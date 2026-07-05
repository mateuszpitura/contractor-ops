import { cf, escapeXml, isoDate } from '../../lib/format.js';
import type { PayrollFeed } from '../../types/feed.js';
import { RTI_EPS_CLASS, RTI_EPS_NAMESPACE, splitPayeRef } from '../rti-shared/constants.js';

export function generateRtiEps(feed: PayrollFeed): Buffer {
  const periodEnd = isoDate(feed.generatedAt);
  const { officeNo, payeRef } = splitPayeRef(cf(feed.employees[0], 'payeReference'));
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<GovTalkMessage xmlns="http://www.govtalk.gov.uk/CM/envelope">',
    '<EnvelopeVersion>2.0</EnvelopeVersion>',
    '<Header>',
    '<MessageDetails>',
    `<Class>${RTI_EPS_CLASS}</Class>`,
    '<Qualifier>request</Qualifier>',
    '<Function>submit</Function>',
    '</MessageDetails>',
    '</Header>',
    '<GovTalkDetails/>',
    '<Body>',
    `<IRenvelope xmlns="${RTI_EPS_NAMESPACE}">`,
    '<IRheader>',
    `<PeriodEnd>${periodEnd}</PeriodEnd>`,
    '<Sender>Employer</Sender>',
    '</IRheader>',
    '<EmployerPaymentSummary>',
    '<EmpRefs>',
    `<OfficeNo>${escapeXml(officeNo)}</OfficeNo>`,
    `<PayeRef>${escapeXml(payeRef)}</PayeRef>`,
    '</EmpRefs>',
    '<NoPaymentForPeriod>yes</NoPaymentForPeriod>',
    '</EmployerPaymentSummary>',
    '</IRenvelope>',
    '</Body>',
    '</GovTalkMessage>',
  ];
  return Buffer.from(`${lines.join('\n')}\n`, 'utf8');
}
