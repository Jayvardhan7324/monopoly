import React, { useState, useEffect } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { TileType, ColorGroup } from '../../types';
import type { CustomTile } from './types';
import { COUNTRIES, flagEmoji, COLOR_GROUP_HEX } from './boardUtils';

interface Props {
  tile: CustomTile | null;
  open: boolean;
  onClose: () => void;
  onSave: (tile: CustomTile) => void;
}

const TILE_TYPES: { value: TileType; label: string }[] = [
  { value: TileType.PROPERTY,        label: 'Property' },
  { value: TileType.RAILROAD,        label: 'Railroad / Airport' },
  { value: TileType.UTILITY,         label: 'Utility' },
  { value: TileType.CHANCE,          label: 'Surprise / Chance' },
  { value: TileType.COMMUNITY_CHEST, label: 'Community Chest' },
  { value: TileType.TAX,             label: 'Tax' },
  { value: TileType.CORNER,          label: 'Corner' },
];

const COLOR_GROUPS: { value: ColorGroup; label: string }[] = [
  { value: ColorGroup.BROWN,      label: 'Brown' },
  { value: ColorGroup.LIGHT_BLUE, label: 'Light Blue' },
  { value: ColorGroup.PINK,       label: 'Pink' },
  { value: ColorGroup.ORANGE,     label: 'Orange' },
  { value: ColorGroup.RED,        label: 'Red' },
  { value: ColorGroup.YELLOW,     label: 'Yellow' },
  { value: ColorGroup.GREEN,      label: 'Green' },
  { value: ColorGroup.DARK_BLUE,  label: 'Dark Blue' },
];

const PRICE_TAG_POSITIONS = [
  { value: 'top',    label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left',   label: 'Left' },
  { value: 'right',  label: 'Right' },
] as const;

const CellEditor: React.FC<Props> = ({ tile, open, onClose, onSave }) => {
  const [form, setForm] = useState<CustomTile | null>(null);

  useEffect(() => {
    if (tile) setForm(JSON.parse(JSON.stringify(tile)));
  }, [tile]);

  if (!form) return null;

  const update = <K extends keyof CustomTile>(key: K, value: CustomTile[K]) =>
    setForm(prev => prev ? { ...prev, [key]: value } : prev);

  const updateRent = (idx: number, val: string) => {
    const next = [...form.rent];
    next[idx] = Number(val) || 0;
    update('rent', next);
  };

  const isProperty = form.type === TileType.PROPERTY;
  const isPurchasable = [TileType.PROPERTY, TileType.RAILROAD, TileType.UTILITY].includes(form.type);

  const handleSave = () => {
    // Ensure rent has 6 values for properties
    const finalForm: CustomTile = {
      ...form,
      rent: isProperty
        ? (form.rent.length === 6 ? form.rent : [...form.rent, ...Array(6).fill(0)].slice(0, 6))
        : [],
    };
    onSave(finalForm);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            Edit Cell #{form.position}
          </SheetTitle>
          <SheetDescription>
            Customize this tile's properties.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={e => update('name', e.target.value)}
              placeholder="e.g. Paris"
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label>Tile Type</Label>
            <Select
              value={form.type}
              onValueChange={v => update('type', v as TileType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TILE_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Country (property/railroad/utility only) */}
          {isPurchasable && (
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Select
                value={form.countryCode || 'us'}
                onValueChange={v => update('countryCode', v)}
              >
                <SelectTrigger>
                  <SelectValue>
                    {form.countryCode
                      ? `${flagEmoji(form.countryCode)} ${COUNTRIES.find(c => c.code === form.countryCode)?.name ?? form.countryCode}`
                      : 'Select country'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {COUNTRIES.map(c => (
                    <SelectItem key={c.code} value={c.code}>
                      {flagEmoji(c.code)} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Color Group (property only) */}
          {isProperty && (
            <div className="space-y-1.5">
              <Label>Color Group</Label>
              <Select
                value={form.group}
                onValueChange={v => update('group', v as ColorGroup)}
              >
                <SelectTrigger>
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-sm"
                        style={{ background: COLOR_GROUP_HEX[form.group] }}
                      />
                      {COLOR_GROUPS.find(g => g.value === form.group)?.label ?? form.group}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {COLOR_GROUPS.map(g => (
                    <SelectItem key={g.value} value={g.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-sm"
                          style={{ background: COLOR_GROUP_HEX[g.value] }}
                        />
                        {g.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Price */}
          {isPurchasable && (
            <div className="space-y-1.5">
              <Label>Purchase Price ($)</Label>
              <Input
                type="number"
                min={0}
                value={form.price}
                onChange={e => update('price', Number(e.target.value))}
              />
            </div>
          )}

          {/* Rent values — property only */}
          {isProperty && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Rent Values ($)</Label>
                {['No buildings', '1 House', '2 Houses', '3 Houses', '4 Houses', 'Hotel'].map((label, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-24 shrink-0">{label}</span>
                    <Input
                      type="number"
                      min={0}
                      value={form.rent[idx] ?? 0}
                      onChange={e => updateRent(idx, e.target.value)}
                      className="h-8"
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label>House Cost ($)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.houseCost}
                  onChange={e => update('houseCost', Number(e.target.value))}
                />
              </div>
            </>
          )}

          {/* Price tag display position */}
          <Separator />
          <div className="space-y-2">
            <Label>Price Tag Position</Label>
            <p className="text-xs text-muted-foreground">Where the price label shows on the board tile.</p>
            <div className="grid grid-cols-4 gap-1.5">
              {PRICE_TAG_POSITIONS.map(pos => (
                <button
                  key={pos.value}
                  type="button"
                  onClick={() => update('priceTagPosition', pos.value)}
                  className={`
                    rounded border px-2 py-1.5 text-xs font-medium transition-colors
                    ${form.priceTagPosition === pos.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:bg-muted'}
                  `}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <Separator />
          <div className="flex gap-2 pt-1">
            <Button className="flex-1" onClick={handleSave}>
              Save Cell
            </Button>
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CellEditor;
