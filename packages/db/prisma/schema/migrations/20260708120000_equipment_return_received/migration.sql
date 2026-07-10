-- ReturnRequestStatus: terminal RECEIVED after courier delivery (portal equipment returns)
ALTER TYPE "ReturnRequestStatus" ADD VALUE IF NOT EXISTS 'RECEIVED';
