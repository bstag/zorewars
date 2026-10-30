;name Silk Imps
;author bstag (ZoreWars), structure after John Metcalf's "paper with silk-imps"
;strategy Two-stage silk paper whose copy loop also launches imps; constants (5773, 341, 2642) searched for the ModelWar arena.
warr    spl    2,            {2300
        spl    1,            {2400
        spl    1,            {2500
pp      mov    {papera,      {boot
boot    spl    *papera+CORESIZE/2+6, {2700
papera  spl    @0+6,         >5773
        mov    }papera,      >papera
        mov    {papera,      <paperb
paperb  spl    @0,           >341
        mov.i  #2642,         }CORESIZE/2-1-2642
        end
