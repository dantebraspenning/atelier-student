'use server';

import { runAction } from '@/lib/errors';
import { list, str } from '@/lib/request-meta';
import { requireActor } from '@/lib/session';
import {
  payoutDashboardLink, saveTaxDetails, setAccepting, startPayoutOnboarding, startSchoolEmailVerification,
  submitDocumentVerification, updateProfile
} from '@/lib/domain/students';
import { addPiece, addPiecePhotos, deletePiece } from '@/lib/domain/portfolio';

export async function profileAction(_: unknown, fd: FormData) {
  return runAction(async () => {
    const labels = list(fd, 'rateLabel');
    const froms = fd.getAll('rateFrom').map(String);
    await updateProfile(await requireActor('student'), {
      name: str(fd, 'name'), programme: str(fd, 'programme'), school: str(fd, 'school'), year: str(fd, 'year'), city: str(fd, 'city'),
      bio: str(fd, 'bio'), turnaround: str(fd, 'turnaround'), specialities: list(fd, 'specialities') as never,
      skills: str(fd, 'skills').split(',').map((s) => s.trim()).filter(Boolean),
      rates: labels.map((label, i) => ({ label, from: froms[i] ?? '' })).filter((r) => r.label || r.from)
    });
  });
}

export async function acceptingAction(accepting: boolean) {
  return runAction(async () => setAccepting(await requireActor('student'), accepting));
}

export async function schoolEmailAction(_: unknown, fd: FormData) {
  return runAction(async () => startSchoolEmailVerification(await requireActor('student'), str(fd, 'schoolEmail')));
}

export async function documentVerificationAction(_: unknown, fd: FormData) {
  return runAction(async () => submitDocumentVerification(await requireActor('student'), list(fd, 'photoIds'), str(fd, 'note')));
}

export async function taxAction(_: unknown, fd: FormData) {
  return runAction(async () => saveTaxDetails(await requireActor('student'), {
    legalName: str(fd, 'legalName'), dateOfBirth: str(fd, 'dateOfBirth'), addressLine: str(fd, 'addressLine'),
    postalCode: str(fd, 'postalCode'), city: str(fd, 'city'), country: str(fd, 'country') || 'NL', tin: str(fd, 'tin')
  }));
}

export async function payoutsAction() {
  return runAction(async () => ({ redirect: await startPayoutOnboarding(await requireActor('student')) }));
}

export async function payoutDashboardAction() {
  return runAction(async () => ({ redirect: await payoutDashboardLink(await requireActor('student')) }));
}

export async function addPieceAction(_: unknown, fd: FormData) {
  return runAction(async () => {
    await addPiece(await requireActor('student'), {
      title: str(fd, 'title'), garment: str(fd, 'garment') as never, material: str(fd, 'material'), story: str(fd, 'story'),
      kind: str(fd, 'kind') === 'commission' ? 'commission' : 'coursework', commissionId: str(fd, 'commissionId') || null, photoIds: list(fd, 'photoIds')
    });
  });
}

export async function addPiecePhotosAction(pieceId: string, photoIds: string[]) {
  return runAction(async () => addPiecePhotos(await requireActor('student'), pieceId, photoIds));
}

export async function deletePieceAction(_: unknown, fd: FormData) {
  return runAction(async () => deletePiece(await requireActor('student'), str(fd, 'id')));
}

