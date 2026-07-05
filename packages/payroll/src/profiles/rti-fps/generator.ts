import { cf, escapeXml, isoDate, splitName } from '../../lib/format.js';
import type { PayrollFeed, PayrollFeedEmployee } from '../../types/feed.js';
import { RTI_FPS_CLASS, RTI_FPS_NAMESPACE, splitPayeRef } from '../rti-shared/constants.js';

function employeeLines(e: PayrollFeedEmployee): string[] {
  const { firstNames, surname } = splitName(e.displayName);
  const plan = cf(e, 'studentLoanPlan');
  const lines = [
    '<Employee>',
    '<EmployeeDetails>',
    '<Name>',
    `<Fore>${escapeXml(firstNames)}</Fore>`,
    `<Sur>${escapeXml(surname)}</Sur>`,
    '</Name>',
    `<NINO>${escapeXml(cf(e, 'niNumber'))}</NINO>`,
    '</EmployeeDetails>',
    '<Employment>',
    `<StartDate>${isoDate(e.hireDate)}</StartDate>`,
    `<PayId>${escapeXml(e.workerId)}</PayId>`,
    '<Payment>',
    `<TaxCode>${escapeXml(cf(e, 'taxCode'))}</TaxCode>`,
  ];
  if (plan && plan !== 'NONE') {
    lines.push('<StudentLoan>', `<PlanType>${escapeXml(plan)}</PlanType>`, '</StudentLoan>');
  }
  lines.push('</Payment>', '</Employment>', '</Employee>');
  return lines;
}

export function generateRtiFps(feed: PayrollFeed): Buffer {
  const periodEnd = isoDate(feed.generatedAt);
  const { officeNo, payeRef } = splitPayeRef(cf(feed.employees[0], 'payeReference'));
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<GovTalkMessage xmlns="http://www.govtalk.gov.uk/CM/envelope">',
    '<EnvelopeVersion>2.0</EnvelopeVersion>',
    '<Header>',
    '<MessageDetails>',
    `<Class>${RTI_FPS_CLASS}</Class>`,
    '<Qualifier>request</Qualifier>',
    '<Function>submit</Function>',
    '</MessageDetails>',
    '</Header>',
    '<GovTalkDetails/>',
    '<Body>',
    `<IRenvelope xmlns="${RTI_FPS_NAMESPACE}">`,
    '<IRheader>',
    `<PeriodEnd>${periodEnd}</PeriodEnd>`,
    '<Sender>Employer</Sender>',
    '</IRheader>',
    '<FullPaymentSubmission>',
    '<EmpRefs>',
    `<OfficeNo>${escapeXml(officeNo)}</OfficeNo>`,
    `<PayeRef>${escapeXml(payeRef)}</PayeRef>`,
    '</EmpRefs>',
    ...feed.employees.flatMap(employeeLines),
    '</FullPaymentSubmission>',
    '</IRenvelope>',
    '</Body>',
    '</GovTalkMessage>',
  ];
  return Buffer.from(`${lines.join('\n')}\n`, 'utf8');
}
