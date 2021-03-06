import { Builder } from '../../engine/Builder';
import { RegisteredFunction } from '../../engine/TransformationEngine';
import { transformFINNetworkTrace } from './structs/FINetworkTrace';
import { transformFText } from './TextProperty';

export function transformArrayProperty(builder: Builder): void {
  builder
    .obj('value')
    .str('type', false) // Tag.InnerType
    .assertNullByte(false) // Tag.HasPropertyGuid
    .int('_itemCount', (ctx) => ctx.obj.values.length)

    .switch('type', {
      IntProperty: (builder) => {
        builder
          .arr('values')
          .loop('_itemCount', (builder) => {
            builder.int('#_index');
          })
          .endArr();
      },
      ByteProperty: (builder) => {
        builder
          .arr('values')
          .loop('_itemCount', (builder) => {
            builder.byte('#_index');
          })
          .endArr();
      },
      FloatProperty: (builder) => {
        // Used in the ProgrammableElevatorMod
        builder
          .arr('values')
          .loop('_itemCount', (builder) => {
            builder.float('#_index');
          })
          .endArr();
      },
      EnumProperty: (builder) => {
        builder
          .arr('values')
          .loop('_itemCount', (builder) => {
            builder.str('#_index');
          })
          .endArr();
      },
      StrProperty: (builder) => {
        builder
          .arr('values')
          .loop('_itemCount', (builder) => {
            builder.str('#_index');
          })
          .endArr();
      },
      TextProperty: (builder) => {
        builder
          .arr('values')
          .loop('_itemCount', (builder) => {
            builder.elem('_index');
            transformFText(builder);
            builder.endElem();
          })
          .endArr();
      },
      ObjectProperty: (builder) => {
        builder
          .arr('values')
          .loop('_itemCount', (builder) => {
            builder.elem('_index').str('levelName').str('pathName').endElem();
          })
          .endArr();
      },
      StructProperty: (builder) => {
        builder
          .str('structName')
          .str('structType')
          .bufferStart('_length', false)
          .int('_zero', (_) => 0, false)
          .exec((ctx) => {
            if (ctx.tmp._zero !== 0) {
              throw new Error(`Not zero, but ${ctx.tmp._zero}`);
            }
          })
          .str('structInnerType', false)
          .hex('propertyGuid', 16, false)
          .assertNullByte(false)
          .arr('values')
          .loop('_itemCount', (builder) => {
            builder.if(
              (ctx) => ctx.parent !== undefined,
              (builder) => {
                transformSpecialStructArray(builder);
              },
              (builder) => {
                // else
                transformOrdinaryStructArray(builder);
              }
            );
          })
          .endArr()
          .bufferEnd();
      },
      InterfaceProperty: (builder) => {
        builder
          .arr('values')
          .loop('_itemCount', (builder) => {
            builder.elem('_index').str('levelName').str('pathName').endElem();
          })
          .endArr();
      },
      $default: (builder) => {
        builder.error((ctx) => `Unknown array type: ${ctx.obj.type}`);
      },
    })
    .endObj();
}

/**
 * Handles special cases for arrays of structs based on the structInnerType
 */
function transformSpecialStructArray(builder: Builder): void {
  // Handle special cases for InventoryItem, FINNetworkTrace(FicsIt-Networks mod), Guid and LinearColor
  builder.switch('^structInnerType', {
    InventoryItem: (builder) => {
      builder
        .elem('_index')
        .str('unk1', false)
        .str('itemName')
        .str('levelName')
        .str('pathName')
        // The Inventory Item is stored here without properties
        .endElem();
    },
    Guid: (builder) => {
      builder.hex('#_index', 16);
    },
    LinearColor: (builder) => {
      builder
        .elem('_index')
        .float('r')
        .float('g')
        .float('b')
        .float('a')
        .endElem();
    },
    Vector: (builder) => {
      builder.elem('_index').float('x').float('y').float('z').endElem();
    },
    FINNetworkTrace: (builder) => {
      builder.elem('_index');
      transformFINNetworkTrace(builder);
      builder.endElem();
    },
    $default: (builder) => transformOrdinaryStructArray(builder),
  });
}

/**
 * Transforms the default case for an array of structs
 */
function transformOrdinaryStructArray(builder: Builder): void {
  builder
    .elem('_index')

    // parse inner properties
    // TODO fix loop for writing
    .arr('properties')
    .exec(
      (ctx) =>
        (ctx.tmp._propertiesCount = ctx.isLoading ? 999999999 : ctx.obj.length)
    )
    .loop('_propertiesCount', (builder) => {
      builder
        .exec((ctx) => {
          if (!ctx.isLoading) {
            ctx.tmp._name = ctx.obj[ctx.tmp._index].name;
          }
        })
        .str('_name')
        .if(
          (ctx) => ctx.tmp._name === 'None',
          (builder) => builder.break()
        )
        .elem('_index')
        .exec((ctx) => (ctx.obj.name = ctx.tmp._name))
        .call(RegisteredFunction.transformProperty)
        .endElem();
    })
    .if(
      (ctx) => !ctx.isLoading,
      (builder) => {
        builder.exec((ctx) => (ctx.tmp._none = 'None')).str('_none');
      }
    )
    .endArr()
    .endElem();
}
