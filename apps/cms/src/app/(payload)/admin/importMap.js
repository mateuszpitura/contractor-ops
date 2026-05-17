import { CollectionCards as CollectionCardsF9c02e79a4aed9a3924487c0cd4cafb1 } from '@payloadcms/next/rsc';
import {
  AlignFeatureClient as AlignFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  BlockquoteFeatureClient as BlockquoteFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  BoldFeatureClient as BoldFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  ChecklistFeatureClient as ChecklistFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  HeadingFeatureClient as HeadingFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  HorizontalRuleFeatureClient as HorizontalRuleFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  IndentFeatureClient as IndentFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  InlineCodeFeatureClient as InlineCodeFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  InlineToolbarFeatureClient as InlineToolbarFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  ItalicFeatureClient as ItalicFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  LinkFeatureClient as LinkFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  OrderedListFeatureClient as OrderedListFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  ParagraphFeatureClient as ParagraphFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  RelationshipFeatureClient as RelationshipFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  StrikethroughFeatureClient as StrikethroughFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  SubscriptFeatureClient as SubscriptFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  SuperscriptFeatureClient as SuperscriptFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  UnderlineFeatureClient as UnderlineFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  UnorderedListFeatureClient as UnorderedListFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  UploadFeatureClient as UploadFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
} from '@payloadcms/richtext-lexical/client';
import {
  LexicalDiffComponent as LexicalDiffComponent44fe37237e0ebf4470c9990d8cb7b07e,
  RscEntryLexicalCell as RscEntryLexicalCell44fe37237e0ebf4470c9990d8cb7b07e,
  RscEntryLexicalField as RscEntryLexicalField44fe37237e0ebf4470c9990d8cb7b07e,
} from '@payloadcms/richtext-lexical/rsc';
import { S3ClientUploadHandler as S3ClientUploadHandlerF97aa6c64367fa259c5bc0567239ef24 } from '@payloadcms/storage-s3/client';

/** @type import('payload').ImportMap */
export const importMap = {
  '@payloadcms/richtext-lexical/rsc#RscEntryLexicalCell':
    RscEntryLexicalCell44fe37237e0ebf4470c9990d8cb7b07e,
  '@payloadcms/richtext-lexical/rsc#RscEntryLexicalField':
    RscEntryLexicalField44fe37237e0ebf4470c9990d8cb7b07e,
  '@payloadcms/richtext-lexical/rsc#LexicalDiffComponent':
    LexicalDiffComponent44fe37237e0ebf4470c9990d8cb7b07e,
  '@payloadcms/richtext-lexical/client#InlineToolbarFeatureClient':
    InlineToolbarFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  '@payloadcms/richtext-lexical/client#HorizontalRuleFeatureClient':
    HorizontalRuleFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  '@payloadcms/richtext-lexical/client#UploadFeatureClient':
    UploadFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  '@payloadcms/richtext-lexical/client#BlockquoteFeatureClient':
    BlockquoteFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  '@payloadcms/richtext-lexical/client#RelationshipFeatureClient':
    RelationshipFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  '@payloadcms/richtext-lexical/client#LinkFeatureClient':
    LinkFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  '@payloadcms/richtext-lexical/client#ChecklistFeatureClient':
    ChecklistFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  '@payloadcms/richtext-lexical/client#OrderedListFeatureClient':
    OrderedListFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  '@payloadcms/richtext-lexical/client#UnorderedListFeatureClient':
    UnorderedListFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  '@payloadcms/richtext-lexical/client#IndentFeatureClient':
    IndentFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  '@payloadcms/richtext-lexical/client#AlignFeatureClient':
    AlignFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  '@payloadcms/richtext-lexical/client#HeadingFeatureClient':
    HeadingFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  '@payloadcms/richtext-lexical/client#ParagraphFeatureClient':
    ParagraphFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  '@payloadcms/richtext-lexical/client#InlineCodeFeatureClient':
    InlineCodeFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  '@payloadcms/richtext-lexical/client#SuperscriptFeatureClient':
    SuperscriptFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  '@payloadcms/richtext-lexical/client#SubscriptFeatureClient':
    SubscriptFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  '@payloadcms/richtext-lexical/client#StrikethroughFeatureClient':
    StrikethroughFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  '@payloadcms/richtext-lexical/client#UnderlineFeatureClient':
    UnderlineFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  '@payloadcms/richtext-lexical/client#BoldFeatureClient':
    BoldFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  '@payloadcms/richtext-lexical/client#ItalicFeatureClient':
    ItalicFeatureClientE70f5e05f09f93e00b997edb1ef0c864,
  '@payloadcms/storage-s3/client#S3ClientUploadHandler':
    S3ClientUploadHandlerF97aa6c64367fa259c5bc0567239ef24,
  '@payloadcms/next/rsc#CollectionCards': CollectionCardsF9c02e79a4aed9a3924487c0cd4cafb1,
};
