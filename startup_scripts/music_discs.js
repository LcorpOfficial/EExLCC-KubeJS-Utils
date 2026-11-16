StartupEvents.registry('sound_event', event => {
  event.create('kubejs:music_disc.elevator')
    .sounds(sound => {
      sound.sound('kubejs:music/elevator', audio => audio.stream())
    })
})

StartupEvents.registry('item', event => {
  event.create('incomplete_music_disc_elevator')
    .displayName('Incomplete Elevator Music Disc')
    .texture('kubejs:item/music_disc_elevator')
    .unstackable()

  event.create('music_disc_elevator')
    .displayName('Elevator Music Disc')
    .texture('kubejs:item/music_disc_elevator')
    .unstackable()
    .rarity('rare')
    .jukeboxPlayable('kubejs:elevator')
})
